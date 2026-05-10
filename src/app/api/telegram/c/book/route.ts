/** --- YAML
 * name: Telegram Client Booking API
 * description: Create booking(s) + find-or-create client + optional reschedule cancel + notify master.
 *              Validates initData.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

interface BookingItem {
  service_id: string;
  starts_at: string;
  ends_at: string;
  price: number;
  currency: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    initData,
    master_id,
    appointments,
    reschedule_id,
    service_names,
    date_formatted,
    selected_time,
    partner_ref_master_id,
    group_booking_id: incomingGroupId,
    gift_cert_code,
    from_waitlist,
  } = body as {
    initData?: string;
    master_id?: string;
    appointments?: BookingItem[];
    reschedule_id?: string;
    service_names?: string;
    date_formatted?: string;
    selected_time?: string;
    partner_ref_master_id?: string;
    group_booking_id?: string;
    gift_cert_code?: string;
    from_waitlist?: string;  // ID waitlist-record если клиент пришёл из «Слот відкрився» уведомления
  };

  if (!initData || !master_id || !Array.isArray(appointments) || appointments.length === 0) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, phone, telegram_id')
    .eq('telegram_id', result.user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  // 1. Find or create client for this master. Use .limit(1) instead of
  //    .maybeSingle() — duplicate rows for same profile+master (created by
  //    separate flows like master-side calendar) would otherwise throw
  //    "more than one row" and we'd create YET ANOTHER duplicate.
  let clientId: string | null = null;
  const { data: existingRows } = await admin
    .from('clients')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('master_id', master_id)
    .is('family_link_id', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    clientId = existingRows[0].id;
  } else {
    // Партнёрская реф-атрибуция: если клиент перешёл с публичной страницы
    // другого мастера через ?from=<id>, и тот мастер действительно — активный
    // партнёр текущего, сохраняем referrer_master_id в новом client row.
    let validRefMasterId: string | null = null;
    if (partner_ref_master_id && partner_ref_master_id !== master_id) {
      const { data: pp } = await admin
        .from('master_partnerships')
        .select('id')
        .or(`and(master_id.eq.${master_id},partner_id.eq.${partner_ref_master_id}),and(master_id.eq.${partner_ref_master_id},partner_id.eq.${master_id})`)
        .eq('status', 'active')
        .maybeSingle();
      if (pp) validRefMasterId = partner_ref_master_id;
    }
    const { data: created, error } = await admin
      .from('clients')
      .insert({
        profile_id: profile.id,
        master_id,
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? null,
        referrer_master_id: validRefMasterId,
      })
      .select('id')
      .single();
    if (error || !created) return NextResponse.json({ error: error?.message ?? 'client_failed' }, { status: 500 });
    clientId = created.id;
  }

  // 2. Bulk insert appointments (with explicit return so we know they landed)
  const groupBookingId = incomingGroupId ?? crypto.randomUUID();
  const rows = appointments.map((a) => ({
    client_id: clientId!,
    master_id,
    service_id: a.service_id,
    booked_via: 'telegram_miniapp',
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: 'booked',
    price: a.price,
    currency: a.currency,
    group_booking_id: groupBookingId,
  }));
  const { data: inserted, error: insErr } = await admin
    .from('appointments')
    .insert(rows)
    .select('id, starts_at, service_id, price, currency');
  if (insErr) {
    console.error('[book] insert failed:', insErr.message, { master_id, clientId, rows });
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    console.error('[book] insert returned no rows', { master_id, clientId, rows });
    return NextResponse.json({ error: 'insert_empty' }, { status: 500 });
  }

  // 2b. Check if master has escrow enabled AND any appointment needs a deposit
  const { computeDepositForBooking } = await import('@/lib/payments/escrow');
  const { data: masterConfig } = await admin
    .from('masters')
    .select('escrow_enabled')
    .eq('id', master_id)
    .maybeSingle();

  const depositsRequired: Array<{ appointment_id: string; amount: number; currency: string; reason: string | null }> = [];
  if (masterConfig?.escrow_enabled) {
    for (const appt of inserted as Array<{ id: string; service_id: string; price: number; currency: string }>) {
      const deposit = await computeDepositForBooking(admin, {
        serviceId: appt.service_id,
        masterId: master_id,
        clientId: clientId!,
      });
      if (deposit.required) {
        await admin
          .from('appointments')
          .update({
            deposit_required: true,
            deposit_amount: deposit.amount,
          })
          .eq('id', appt.id);
        depositsRequired.push({
          appointment_id: appt.id,
          amount: deposit.amount,
          currency: appt.currency,
          reason: deposit.reason,
        });
      }
    }
  }

  // 3. If reschedule: cancel original appointment. Match by id + master_id
  //    (master scope, safer than client_id because old appt may live under a
  //    different clients row if the master created it from dashboard without
  //    linking profile_id).
  if (reschedule_id) {
    const { error: cancelErr } = await admin
      .from('appointments')
      .update({
        status: 'cancelled_by_client',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'client',
        cancellation_reason: 'rescheduled',
      })
      .eq('id', reschedule_id)
      .eq('master_id', master_id);
    if (cancelErr) console.error('[book] cancel old failed:', cancelErr.message);
  }

  // 3b. Если клиент пришёл из «🟢 Слот відкрився» уведомления — закрепить
  //     новый apt за waitlist-record. Cron больше не откатит резерв (т.к.
  //     matched_appointment_id теперь поинтит на booked apt).
  let waitlistMatched = false;
  if (from_waitlist) {
    const newAptId = (inserted as Array<{ id: string }>)[0]?.id;
    if (newAptId) {
      const { error: wlErr } = await admin
        .from('waitlist')
        .update({ matched_appointment_id: newAptId, reserved_until: null })
        .eq('id', from_waitlist)
        .eq('client_profile_id', profile.id)  // защита: только своя waitlist-запись
        .eq('status', 'matched');
      if (!wlErr) waitlistMatched = true;
    }
  }

  // 4. Notify master — direct TG (bypass daily cron) + in_app record
  const { data: master } = await admin
    .from('masters')
    .select('profile_id, profile:profiles!masters_profile_id_fkey(telegram_id)')
    .eq('id', master_id)
    .maybeSingle();
  const masterProfileId = master?.profile_id;
  const masterTg = (master as { profile?: { telegram_id?: number | null } | null } | null)?.profile?.telegram_id;
  const isReschedule = !!reschedule_id;
  const title = waitlistMatched
    ? '🟢 Запис із листа очікування'
    : (isReschedule ? '🔄 Запись перенесена' : '✨ Новая запись');
  const bodyText = `${service_names ?? 'Услуга'} — ${date_formatted ?? ''} в ${selected_time ?? ''}`;

  const { sendMessage } = await import('@/lib/telegram/bot');

  if (masterTg) {
    try {
      const clientName = profile.full_name ?? 'Клиент';
      const heading = waitlistMatched
        ? `<b>🟢 Запис із листа очікування</b>\n<i>Клієнт давно чекав на твоє вікно</i>`
        : (isReschedule
          ? `<b>🔄 Запись перенесена клиентом</b>`
          : `<b>✨ Новая запись</b>`);
      await sendMessage(
        masterTg as unknown as number,
        `${heading}\n\nКлиент: ${clientName}\nУслуга: ${service_names ?? '—'}\nДата: ${date_formatted ?? '—'}\nВремя: ${selected_time ?? '—'}`,
        { parse_mode: 'HTML' },
      );
    } catch { /* ignore */ }
  }

  // 4b. Notify CLIENT — handled by DB trigger dispatch_booking_notification
  // (event_type='created' or 'rescheduled') which inserts a 'pending' row into
  // notifications. The cron /api/cron/notifications flushes it within ~1 min.
  // The trigger reads master's custom message_templates row (kind=
  // 'booking_confirmation' or 'appointment_rescheduled') and substitutes
  // {service_name}, {master_name}, {client_name}, {time}, {old_time}, {price},
  // {address}, {confirm_url}, falling back to the rich 6/4-line default if
  // master hasn't customized. We INTENTIONALLY do NOT send a direct TG here —
  // doing so would duplicate the trigger's pending notification.

  if (masterProfileId && service_names && date_formatted && selected_time) {
    await admin.from('notifications').insert({
      profile_id: masterProfileId,
      channel: 'telegram',
      title,
      body: bodyText,
      status: masterTg ? 'sent' : 'pending',
      sent_at: masterTg ? new Date().toISOString() : null,
      data: { type: isReschedule ? 'appointment_rescheduled' : 'new_booking', client_id: clientId, action_url: '/calendar' },
    });
  }
  // In-app notification for client (notification bell in Mini App)
  if (profile.id && service_names && date_formatted && selected_time) {
    await admin.from('notifications').insert({
      profile_id: profile.id,
      channel: 'in_app',
      title: isReschedule ? 'Запись перенесена' : 'Запись подтверждена',
      body: bodyText,
      status: 'sent',
      sent_at: new Date().toISOString(),
      data: { type: isReschedule ? 'appointment_rescheduled' : 'appointment_created', action_url: '/telegram/app/activity' },
    });
  }

  // Redeem gift certificate if provided (fire-and-forget: booking is already committed)
  if (gift_cert_code) {
    await admin
      .from('gift_certificates')
      .update({ is_redeemed: true, redeemed_by: clientId })
      .eq('master_id', master_id)
      .ilike('code', gift_cert_code.trim())
      .eq('is_redeemed', false)
      .then(() => null, () => null);
  }

  return NextResponse.json({
    ok: true,
    clientId,
    appointmentIds: (inserted as Array<{ id: string }>).map((a) => a.id),
    depositsRequired,
    groupBookingId,
  });
}
