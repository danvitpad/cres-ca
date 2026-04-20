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
    .select('id, full_name, phone')
    .eq('telegram_id', result.user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  // 1. Find or create client for this master
  let clientId: string | null = null;
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('master_id', master_id)
    .is('family_link_id', null)
    .maybeSingle();
  if (existing) {
    clientId = existing.id;
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

  // 2. Bulk insert appointments
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
  const { error: insErr } = await admin.from('appointments').insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // 3. If reschedule: cancel original (must belong to this client)
  if (reschedule_id) {
    await admin
      .from('appointments')
      .update({
        status: 'cancelled_by_client',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'client',
        cancellation_reason: 'rescheduled',
      })
      .eq('id', reschedule_id)
      .eq('client_id', clientId!);
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

  if (masterTg) {
    const { sendMessage } = await import('@/lib/telegram/bot');
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

  return NextResponse.json({ ok: true, clientId });
}
