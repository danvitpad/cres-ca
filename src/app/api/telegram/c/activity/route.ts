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

  const { data: profile } = await admin.from('profiles').select('id, full_name, phone').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ appointments: [], _debug: { reason: 'no_profile_for_tg', tg_id: result.user.id } });

  // 1) clients linked by profile_id (norm path)
  // 2) fallback by phone — мастер мог завести клиента вручную с тем же
  //    телефоном что у профиля, но без profile_id. Без этого фоллбэка
  //    клиент видит пустую вкладку Записи (баг B16 был та же причина).
  let clientIds: string[] = [];
  const { data: byProfile } = await admin
    .from('clients').select('id').eq('profile_id', profile.id);
  clientIds = (byProfile ?? []).map((c) => c.id as string);
  if (clientIds.length === 0 && profile.phone) {
    const { data: byPhone } = await admin
      .from('clients').select('id').eq('phone', profile.phone.trim());
    clientIds = (byPhone ?? []).map((c) => c.id as string);
  }
  if (clientIds.length === 0) {
    return NextResponse.json({
      appointments: [],
      _debug: {
        reason: 'no_clients_for_profile_or_phone',
        profile_id: profile.id,
        profile_name: profile.full_name,
        profile_phone: profile.phone,
        tg_id: result.user.id,
      },
    });
  }

  if (id) {
    const { data: appointment } = await admin
      .from('appointments')
      .select(
        'id, starts_at, ends_at, status, price, currency, master_id, service_id, notes, service:services(name, color, description), master:masters(id, display_name, specialization, avatar_url, address, city, latitude, longitude, cancellation_policy, profile:profiles!masters_profile_id_fkey(full_name, avatar_url, phone, telegram_username))',
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

  const { data, error } = await admin
    .from('appointments')
    .select(
      'id, starts_at, ends_at, status, price, currency, client_id, service_id, master_id, master:masters(id, display_name, avatar_url, specialization, salon_id, cancellation_policy, profile:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(id, name, logo_url, city)), service:services(name, color, duration_minutes)',
    )
    .in('client_id', clientIds)
    .order('starts_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({
      appointments: [],
      _debug: {
        reason: 'query_failed',
        error_message: error.message,
        profile_id: profile.id,
        client_ids: clientIds,
      },
    }, { status: 500 });
  }

  // Mark which appointments already have a review from this user — needed so
  // the page knows whether to show «Оцінити» button or just badge «Залишено
  // відгук». Раньше reviewExists приходил только в detail-запросе → список
  // всегда показывал кнопку «Оцінити» даже когда отзыв уже оставлен.
  const aptIds = (data ?? []).map((a) => a.id);
  let reviewedSet = new Set<string>();
  if (aptIds.length > 0) {
    const { data: revs } = await admin
      .from('reviews').select('appointment_id')
      .in('appointment_id', aptIds)
      .eq('reviewer_id', profile.id)
      .eq('target_type', 'master');
    reviewedSet = new Set((revs ?? []).map((r) => r.appointment_id as string));
  }
  const enriched = (data ?? []).map((a) => ({
    ...a,
    reviewExists: reviewedSet.has(a.id),
  }));

  return NextResponse.json({
    appointments: enriched,
    _debug: {
      profile_id: profile.id,
      profile_name: profile.full_name,
      tg_id: result.user.id,
      appointment_count: enriched.length,
    },
  });
}
