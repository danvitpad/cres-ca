/** --- YAML
 * name: Notification Dispatch
 * description: Immediate delivery endpoint — inserts row in notifications table as 'sent'
 *              AND sends Telegram message in one round-trip. Used by UI actions (appointment
 *              create, reminders, broadcasts) so delivery doesn't depend on daily cron.
 *              Auth: authenticated caller must be the target profile OR a master whose
 *              clients.profile_id = target.
 * created: 2026-04-20
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

interface Payload {
  profile_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<Payload>;
  const target = body.profile_id?.trim();
  const title = (body.title || '').slice(0, 200);
  const text = (body.body || '').slice(0, 2000);
  if (!target || !text) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  // Authorization: caller is the target, OR caller is a master whose client.profile_id = target
  let allowed = target === user.id;
  if (!allowed) {
    const { data: master } = await supabase
      .from('masters').select('id').eq('profile_id', user.id).maybeSingle();
    if (master) {
      const { count } = await supabase
        .from('clients').select('id', { count: 'exact', head: true })
        .eq('master_id', master.id).eq('profile_id', target);
      allowed = (count ?? 0) > 0;
    }
  }
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Load target's telegram_id
  const { data: profile } = await admin
    .from('profiles').select('telegram_id').eq('id', target).maybeSingle();
  const telegramId = profile?.telegram_id;

  // Insert notification row — mark 'sent' if TG succeeds, 'pending' otherwise (cron can retry)
  let delivered = false;
  let tgError: string | null = null;
  if (telegramId) {
    try {
      const fullText = title ? `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(text)}` : escapeHtml(text);
      const resp = await sendMessage(telegramId as unknown as number, fullText, { parse_mode: 'HTML' });
      const ok = (resp as { ok?: boolean })?.ok;
      delivered = !!ok;
      if (!ok) tgError = (resp as { description?: string })?.description ?? 'tg_failed';
    } catch (err) {
      tgError = (err as Error).message;
    }
  } else {
    tgError = 'no_telegram_linked';
  }

  await admin.from('notifications').insert({
    profile_id: target,
    channel: 'telegram',
    title,
    body: text,
    status: delivered ? 'sent' : 'pending',
    sent_at: delivered ? new Date().toISOString() : null,
    data: body.data ?? null,
  });

  return NextResponse.json({ delivered, error: delivered ? null : tgError });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
