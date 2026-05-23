/** --- YAML
 * name: Appointment Notify
 * description: POST {triggeredBy} → flushes pending booking notifications
 *              created by DB trigger (dispatch_booking_notification) by sending
 *              Telegram messages immediately and marking them as 'sent'.
 *              The trigger handles both client and master notifications with
 *              correct copy based on booked_via. This endpoint just makes the
 *              dispatch immediate (default cron is up to 5 min).
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: appointmentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adm = admin();

  // Verify caller is master or client of this appointment + load full state
  const { data: apt } = await adm
    .from('appointments')
    .select('id, master_id, client_id, status, starts_at, price, currency, cancelled_by, cancellation_reason, service:services(name), client:clients(full_name)')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!apt) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [{ data: masterRow }, { data: clientRow }] = await Promise.all([
    adm.from('masters').select('profile_id').eq('id', apt.master_id).maybeSingle(),
    adm.from('clients').select('profile_id').eq('id', apt.client_id).maybeSingle(),
  ]);
  const masterProfileId = (masterRow as { profile_id: string } | null)?.profile_id ?? null;
  const clientProfileId = (clientRow as { profile_id: string | null } | null)?.profile_id ?? null;

  if (masterProfileId !== user.id && clientProfileId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // ─── Ensure master also gets a notification ───────────────────────
  // DB trigger dispatch_booking_notification only inserts a CLIENT row.
  // Without this block:
  //   • client booking via /book → master gets nothing
  //   • client cancellation via /appointments → master gets nothing
  //   • client reschedule via /book?reschedule=X → master gets nothing
  // Mini App endpoint /api/telegram/c/book has its own master TG send
  // (does NOT call this endpoint) so no dup here.
  if (masterProfileId) {
    const aptStatus = (apt as { status: string }).status;
    const cancelledBy = (apt as { cancelled_by: string | null }).cancelled_by;
    const cancelReason = (apt as { cancellation_reason: string | null }).cancellation_reason;
    const startsAt = (apt as { starts_at: string }).starts_at;
    const aptPrice = (apt as { price: number | null }).price;
    const aptCurrency = (apt as { currency: string | null }).currency;
    const svcRaw = (apt as { service: { name?: string } | { name?: string }[] | null }).service;
    const cliRaw = (apt as { client: { full_name?: string } | { full_name?: string }[] | null }).client;
    const svc = Array.isArray(svcRaw) ? svcRaw[0] : svcRaw;
    const cli = Array.isArray(cliRaw) ? cliRaw[0] : cliRaw;
    const clientName = cli?.full_name || 'Клиент';
    const serviceName = svc?.name || 'услугу';
    const when = startsAt
      ? new Date(startsAt).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
    const cur = aptCurrency === 'UAH' ? '₴' : aptCurrency || '';
    const priceLine = aptPrice && Number(aptPrice) > 0 ? `\nСтоимость: ${Number(aptPrice)} ${cur}` : '';

    // Determine which event to notify master about based on appointment state.
    // Reschedule path = old appt status=cancelled_by_client + cancellation_reason='rescheduled'
    // + new appt status=booked. We notify master ONLY about the new appt
    // (booking_created_master). The cancelled-by-reschedule row is skipped.
    const isCancellation =
      ['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(aptStatus);
    const isReschedule = cancelReason === 'rescheduled';
    const isClientInitiated = cancelledBy === 'client' || aptStatus === 'cancelled_by_client';
    const isActive = ['booked', 'confirmed'].includes(aptStatus);

    let kind: string | null = null;
    let title = '';
    let body = '';

    if (isActive) {
      // New booking — notify master
      kind = 'booking_created_master';
      title = '✨ Новая запись';
      body = `${clientName} записался к вам на ${serviceName} — ${when}.${priceLine}`;
    } else if (isCancellation && !isReschedule && isClientInitiated) {
      // Client cancelled — notify master
      kind = 'booking_cancelled_master';
      title = '⚠️ Клиент отменил запись';
      body = `${clientName} отменил запись на ${serviceName} (${when}).`;
    }
    // Master-initiated cancellation: client is notified by trigger 00093 → skip here.
    // Reschedule: new appt's booking_created_master covers it → skip the cancellation half.

    if (kind) {
      const { data: existing } = await adm
        .from('notifications')
        .select('id')
        .eq('profile_id', masterProfileId)
        .filter('data->>apt_id', 'eq', appointmentId)
        .filter('data->>kind', 'eq', kind)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .maybeSingle();
      if (!existing) {
        await adm.from('notifications').insert({
          profile_id: masterProfileId,
          channel: 'telegram',
          status: 'pending',
          scheduled_for: new Date().toISOString(),
          title,
          body,
          data: { kind, apt_id: appointmentId, client_id: apt.client_id },
        });
      }
    }
  }

  // Find all pending telegram notifications for this appointment
  const { data: pending } = await adm
    .from('notifications')
    .select('id, profile_id, title, body, status')
    .eq('channel', 'telegram')
    .eq('status', 'pending')
    .filter('data->>apt_id', 'eq', appointmentId);

  if (!pending || pending.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Fetch telegram_ids in one query
  const profileIds = Array.from(new Set(pending.map((n) => n.profile_id)));
  const { data: profiles } = await adm
    .from('profiles')
    .select('id, telegram_id')
    .in('id', profileIds);
  const tgByProfile = new Map<string, number | null>();
  (profiles ?? []).forEach((p: { id: string; telegram_id: number | string | null }) => {
    tgByProfile.set(p.id, p.telegram_id ? Number(p.telegram_id) : null);
  });

  let sent = 0;
  for (const n of pending) {
    const chatId = tgByProfile.get(n.profile_id);
    if (chatId) {
      const html = `<b>${escapeHtml(n.title)}</b>\n${escapeHtml(n.body)}`;
      try {
        await sendMessage(chatId, html, { parse_mode: 'HTML' });
        sent++;
      } catch {
        continue; // leave as pending; cron will retry
      }
    }
    // Mark sent regardless of telegram_id (no chatId → cron also can't send)
    await adm
      .from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', n.id);
  }

  return NextResponse.json({ ok: true, sent });
}
