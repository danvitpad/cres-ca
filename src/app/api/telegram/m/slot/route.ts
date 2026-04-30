/** --- YAML
 * name: Telegram Master Quick Booking API
 * description: GET mode returns clients+services for booking UI. POST mode creates an appointment.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';
import { notifyUser } from '@/lib/notifications/notify';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { initData, mode } = body;
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  if (mode === 'create') {
    const { client_id, service_id, starts_at, ends_at, price, currency } = body;
    if (!client_id || !service_id || !starts_at || !ends_at) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 });
    }

    // Verify client + service ownership
    const [{ data: cOwner }, { data: sOwner }] = await Promise.all([
      admin.from('clients').select('master_id').eq('id', client_id).maybeSingle(),
      admin.from('services').select('master_id').eq('id', service_id).maybeSingle(),
    ]);
    if (!cOwner || cOwner.master_id !== master.id) return NextResponse.json({ error: 'forbidden_client' }, { status: 403 });
    if (!sOwner || sOwner.master_id !== master.id) return NextResponse.json({ error: 'forbidden_service' }, { status: 403 });

    const { data, error } = await admin
      .from('appointments')
      .insert({
        master_id: master.id,
        client_id,
        service_id,
        starts_at,
        ends_at,
        status: 'confirmed',
        price: Number(price ?? 0),
        currency: currency ?? 'UAH',
        booked_via: 'master_miniapp',
      })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });

    // Notify client about new appointment (best-effort)
    const [{ data: clientRow }, { data: serviceRow }, { data: masterRow }] = await Promise.all([
      admin.from('clients').select('profile_id, full_name').eq('id', client_id).maybeSingle(),
      admin.from('services').select('name').eq('id', service_id).maybeSingle(),
      admin.from('masters').select('display_name').eq('id', master.id).maybeSingle(),
    ]);
    const clientProfileId = (clientRow as { profile_id: string | null } | null)?.profile_id ?? null;
    if (clientProfileId) {
      const serviceName = (serviceRow as { name?: string } | null)?.name || 'Услуга';
      const masterName = (masterRow as { display_name?: string } | null)?.display_name || 'Мастер';
      const startsAt = new Date(starts_at as string);
      const dateStr = startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      const timeStr = startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
      notifyUser(admin, {
        profileId: clientProfileId,
        title: 'Запись подтверждена',
        body: `${serviceName} у ${masterName}, ${dateStr} в ${timeStr}`,
        data: { type: 'appointment_created', appointment_id: data.id },
        deepLinkPath: '/telegram/app/activity',
        deepLinkLabel: 'Мои записи',
      }).catch(() => undefined);
    }

    return NextResponse.json({ id: data.id });
  }

  // Default: load options
  const [{ data: clients }, { data: services }] = await Promise.all([
    admin
      .from('clients')
      .select('id, full_name, phone')
      .eq('master_id', master.id)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(300),
    admin
      .from('services')
      .select('id, name, duration_minutes, price, currency')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  return NextResponse.json({
    masterId: master.id,
    clients: clients ?? [],
    services: services ?? [],
  });
}
