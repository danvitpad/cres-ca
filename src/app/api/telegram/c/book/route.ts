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
  } = body as {
    initData?: string;
    master_id?: string;
    appointments?: BookingItem[];
    reschedule_id?: string;
    service_names?: string;
    date_formatted?: string;
    selected_time?: string;
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
    const { data: created, error } = await admin
      .from('clients')
      .insert({
        profile_id: profile.id,
        master_id,
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? null,
      })
      .select('id')
      .single();
    if (error || !created) return NextResponse.json({ error: error?.message ?? 'client_failed' }, { status: 500 });
    clientId = created.id;
  }

  // 2. Bulk insert appointments (with explicit return so we know they landed)
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

  // 4. Notify master — direct TG (bypass daily cron) + in_app record
  const { data: master } = await admin
    .from('masters')
    .select('profile_id, profile:profiles!masters_profile_id_fkey(telegram_id)')
    .eq('id', master_id)
    .maybeSingle();
  const masterProfileId = master?.profile_id;
  const masterTg = (master as { profile?: { telegram_id?: number | null } | null } | null)?.profile?.telegram_id;
  const isReschedule = !!reschedule_id;
  const title = isReschedule ? '🔄 Запись перенесена' : '✨ Новая запись';
  const bodyText = `${service_names ?? 'Услуга'} — ${date_formatted ?? ''} в ${selected_time ?? ''}`;

  const { sendMessage } = await import('@/lib/telegram/bot');

  if (masterTg) {
    try {
      const clientName = profile.full_name ?? 'Клиент';
      const heading = isReschedule
        ? `<b>🔄 Запись перенесена клиентом</b>`
        : `<b>✨ Новая запись</b>`;
      await sendMessage(
        masterTg as unknown as number,
        `${heading}\n\nКлиент: ${clientName}\nУслуга: ${service_names ?? '—'}\nДата: ${date_formatted ?? '—'}\nВремя: ${selected_time ?? '—'}`,
        { parse_mode: 'HTML' },
      );
    } catch { /* ignore */ }
  }

  // 4b. Notify CLIENT — confirmation DM in their TG
  // Client has a profile_id, and we can look up their telegram_id directly.
  try {
    if (profile.telegram_id) {
      const masterProfileFetch = await admin
        .from('masters')
        .select('display_name, profile:profiles!masters_profile_id_fkey(full_name)')
        .eq('id', master_id)
        .maybeSingle();
      const masterRow = masterProfileFetch.data as { display_name: string | null; profile: { full_name: string | null } | null } | null;
      const masterName = masterRow?.profile?.full_name ?? masterRow?.display_name ?? 'мастер';

      const clientHeading = isReschedule
        ? `<b>🔄 Запись перенесена</b>`
        : `<b>✅ Запись подтверждена</b>`;
      const clientBody = `${clientHeading}\n\nМастер: ${masterName}\nУслуга: ${service_names ?? '—'}\nДата: ${date_formatted ?? '—'}\nВремя: ${selected_time ?? '—'}\n\nНапомним за день и за 2 часа до визита.`;

      await sendMessage(profile.telegram_id as unknown as number, clientBody, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('[book] client TG notify failed:', (e as Error).message);
  }

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

  return NextResponse.json({
    ok: true,
    clientId,
    appointmentIds: (inserted as Array<{ id: string }>).map((a) => a.id),
    depositsRequired,
  });
}
