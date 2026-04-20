/** --- YAML
 * name: Telegram Client Activity API
 * description: Returns all user's appointments (past + upcoming), or detail by id.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, id } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id, full_name').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ appointments: [], _debug: { reason: 'no_profile_for_tg', tg_id: result.user.id } });

  const { data: clientRows } = await admin.from('clients').select('id, full_name, master_id').eq('profile_id', profile.id);
  const clientIds = (clientRows ?? []).map((c) => c.id);
  if (clientIds.length === 0) {
    return NextResponse.json({
      appointments: [],
      _debug: {
        reason: 'no_clients_for_profile',
        profile_id: profile.id,
        profile_name: profile.full_name,
        tg_id: result.user.id,
      },
    });
  }

  if (id) {
    const { data: appointment } = await admin
      .from('appointments')
      .select(
        'id, starts_at, ends_at, status, price, currency, master_id, service_id, notes, service:services(name, color, description), master:masters(id, display_name, specialization, avatar_url, address, city, latitude, longitude, cancellation_policy, profile:profiles!masters_profile_id_fkey(full_name, avatar_url, phone))',
      )
      .eq('id', id)
      .in('client_id', clientIds)
      .maybeSingle();
    if (!appointment) return NextResponse.json({ appointment: null });

    const [{ data: review }, { data: photos }] = await Promise.all([
      admin
        .from('reviews')
        .select('id')
        .eq('appointment_id', id)
        .eq('reviewer_id', profile.id)
        .eq('target_type', 'master')
        .maybeSingle(),
      admin
        .from('before_after_photos')
        .select('id, before_url, after_url, caption')
        .eq('appointment_id', id),
    ]);
    return NextResponse.json({
      appointment,
      reviewExists: !!review,
      beforeAfterPhotos: photos ?? [],
    });
  }

  const { data } = await admin
    .from('appointments')
    .select(
      'id, starts_at, ends_at, status, price, currency, client_id, service_id, master_id, master:masters(id, display_name, avatar_url, specialization, salon_id, cancellation_policy, profile:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(id, name, logo_url, city, rating)), service:services(name, color, duration_minutes)',
    )
    .in('client_id', clientIds)
    .order('starts_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    appointments: data ?? [],
    _debug: {
      profile_id: profile.id,
      profile_name: profile.full_name,
      tg_id: result.user.id,
      client_rows: clientRows,
      appointment_count: (data ?? []).length,
    },
  });
}
