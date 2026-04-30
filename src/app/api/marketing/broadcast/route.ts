/** --- YAML
 * name: Master Broadcast
 * description: POST — мастер создаёт broadcast: {subject, body, audience, scheduled_for?}.
 *              Считает audience (subscribers / favorites / all_clients), создаёт row в
 *              master_broadcasts, генерирует deliveries и сразу запускает fanout (или
 *              кладёт в queue для scheduled). GET — список рассылок мастера.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage as sendTelegramMessage } from '@/lib/telegram/bot';

interface BroadcastInput {
  subject?: string;
  body: string;
  audience?: 'subscribers' | 'favorites' | 'all_clients';
  scheduledFor?: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data, error } = await supabase
    .from('master_broadcasts')
    .select('id, subject, body, audience, recipients_count, delivered_count, failed_count, status, scheduled_for, sent_at, created_at')
    .eq('master_id', master.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { checkFeatureAccess } = await import('@/lib/subscription/feature-access');
  const access = await checkFeatureAccess(user.id, 'auto_messages');
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'feature_locked', feature: 'auto_messages', required_tier: 'pro', current_tier: access.tier },
      { status: 402 },
    );
  }

  const body = (await req.json().catch(() => null)) as BroadcastInput | null;
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: 'empty_body' }, { status: 400 });
  }
  if (body.body.length > 2000) {
    return NextResponse.json({ error: 'too_long' }, { status: 400 });
  }

  const audience = body.audience ?? 'subscribers';
  if (!['subscribers', 'favorites', 'all_clients'].includes(audience)) {
    return NextResponse.json({ error: 'bad_audience' }, { status: 400 });
  }

  // Resolve master
  const { data: master } = await supabase
    .from('masters')
    .select('id, display_name')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Resolve recipients (profile_ids)
  const recipientIds = await resolveRecipients(supabase, master.id, audience);
  if (recipientIds.length === 0) {
    return NextResponse.json({ error: 'no_recipients', message: 'Нет получателей в выбранной аудитории' }, { status: 400 });
  }

  // Create broadcast
  const { data: broadcast, error: bErr } = await supabase
    .from('master_broadcasts')
    .insert({
      master_id: master.id,
      subject: body.subject?.trim() || null,
      body: body.body.trim(),
      audience,
      recipients_count: recipientIds.length,
      scheduled_for: body.scheduledFor || null,
      status: body.scheduledFor ? 'queued' : 'sending',
      sent_at: body.scheduledFor ? null : new Date().toISOString(),
    })
    .select('id')
    .single();
  if (bErr || !broadcast) {
    return NextResponse.json({ error: bErr?.message ?? 'insert_failed' }, { status: 500 });
  }

  // Insert delivery rows
  const deliveryRows = recipientIds.map((pid) => ({ broadcast_id: broadcast.id, profile_id: pid }));
  await supabase.from('master_broadcast_deliveries').insert(deliveryRows);

  // If immediate — fanout via TG bot
  if (!body.scheduledFor) {
    fanoutInBackground(broadcast.id, recipientIds, body.subject?.trim() ?? null, body.body.trim(), master.display_name ?? 'Мастер');
  }

  return NextResponse.json({
    id: broadcast.id,
    recipients: recipientIds.length,
    status: body.scheduledFor ? 'queued' : 'sending',
  });
}

async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  masterId: string,
  audience: string,
): Promise<string[]> {
  if (audience === 'subscribers') {
    const { data } = await supabase
      .from('client_master_links')
      .select('profile_id')
      .eq('master_id', masterId);
    return (data ?? []).map((r) => r.profile_id as string);
  }
  if (audience === 'favorites') {
    const { data } = await supabase
      .from('client_favorites')
      .select('profile_id')
      .eq('master_id', masterId);
    return (data ?? []).map((r) => r.profile_id as string);
  }
  if (audience === 'all_clients') {
    // All clients in master's CRM — clients.profile_id (not null)
    const { data } = await supabase
      .from('clients')
      .select('profile_id')
      .eq('master_id', masterId)
      .not('profile_id', 'is', null);
    return (data ?? []).map((r) => r.profile_id as string).filter(Boolean);
  }
  return [];
}

/** Fire-and-forget fanout. Pushes to notifications (which TG bot picks up via notif cron),
 *  ИЛИ напрямую в Telegram если у профиля есть telegram_id. */
async function fanoutInBackground(
  broadcastId: string,
  recipientIds: string[],
  subject: string | null,
  body: string,
  masterName: string,
) {
  // Use direct admin client for background work (no auth context).
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Get telegram_ids for direct sending; profiles without TG fall back to notifications row
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, telegram_id')
    .in('id', recipientIds);
  const tgMap = new Map<string, string>();
  for (const p of (profiles ?? []) as Array<{ id: string; telegram_id: string | null }>) {
    if (p.telegram_id) tgMap.set(p.id, p.telegram_id);
  }

  let delivered = 0;
  let failed = 0;
  const tgTitle = subject ? `*${subject}*\n\n` : '';
  const tgText = `${tgTitle}${body}\n\n— ${masterName}`;

  for (const pid of recipientIds) {
    const tgId = tgMap.get(pid);
    let deliveredOk = false;
    let errMsg: string | null = null;

    if (tgId) {
      try {
        await sendTelegramMessage(tgId, tgText, { parse_mode: 'Markdown' });
        deliveredOk = true;
      } catch (e) {
        errMsg = (e as Error).message;
      }
    }

    // Also write to notifications table (for in-app bell + audit)
    await admin.from('notifications').insert({
      profile_id: pid,
      channel: tgId ? 'telegram' : 'web',
      title: subject || `Сообщение от ${masterName}`,
      body,
      scheduled_for: new Date().toISOString(),
      data: { broadcast_id: broadcastId, kind: 'master_broadcast' },
    });

    if (!tgId) deliveredOk = true; // we treat in-app as delivered

    await admin
      .from('master_broadcast_deliveries')
      .update({
        delivered: deliveredOk,
        delivered_at: deliveredOk ? new Date().toISOString() : null,
        error: errMsg,
      })
      .eq('broadcast_id', broadcastId)
      .eq('profile_id', pid);

    if (deliveredOk) delivered++;
    else failed++;
  }

  await admin
    .from('master_broadcasts')
    .update({
      status: 'done',
      delivered_count: delivered,
      failed_count: failed,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', broadcastId);
}
