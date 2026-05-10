/** --- YAML
 * name: Mini App — Master Waitlist List
 * description: Возвращает waitlist-записи мастера: клиенты в очереди (waiting),
 *              кому сейчас зарезервирован слот (matched + reserved_until > now),
 *              и недавно успешные броньки (status=matched + matched_appointment_id
 *              указывает на active appointment). Для каждой строки — имя клиента,
 *              услуга, предпочтения по дням/времени, статус.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

interface WaitlistRow {
  id: string;
  client_profile_id: string;
  service_id: string | null;
  preferred_days: number[] | null;
  preferred_time_window: string | null;
  status: string;
  notified_at: string | null;
  reserved_until: string | null;
  matched_appointment_id: string | null;
  expires_at: string;
  created_at: string;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Найти master_id текущего пользователя
  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Активные waitlist-records: waiting + matched (резерв ещё активен или успешная бронь)
  const { data: rows } = await admin
    .from('waitlist')
    .select('id, client_profile_id, service_id, preferred_days, preferred_time_window, status, notified_at, reserved_until, matched_appointment_id, expires_at, created_at')
    .eq('master_id', master.id)
    .in('status', ['waiting', 'matched'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(50) as { data: WaitlistRow[] | null };

  const items = rows ?? [];
  if (items.length === 0) return NextResponse.json({ entries: [] });

  // Подгружаем имена клиентов и услуг одним запросом
  const profileIds = Array.from(new Set(items.map((r) => r.client_profile_id)));
  const serviceIds = Array.from(new Set(items.map((r) => r.service_id).filter((x): x is string => Boolean(x))));

  const [{ data: profiles }, { data: services }] = await Promise.all([
    admin.from('profiles').select('id, full_name, telegram_id').in('id', profileIds),
    serviceIds.length
      ? admin.from('services').select('id, name').in('id', serviceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; telegram_id: string | null }) => [p.id, p]),
  );
  const serviceById = new Map(
    (services ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
  );

  // Для matched-record'ов с matched_appointment_id — проверим, успешная ли бронь
  const aptIds = items
    .filter((r) => r.status === 'matched' && r.matched_appointment_id)
    .map((r) => r.matched_appointment_id!);
  const apptStatus = new Map<string, string>();
  if (aptIds.length) {
    const { data: apts } = await admin
      .from('appointments')
      .select('id, status')
      .in('id', aptIds);
    for (const a of (apts ?? []) as Array<{ id: string; status: string }>) {
      apptStatus.set(a.id, a.status);
    }
  }

  const enriched = items.map((r) => {
    const profile = profileById.get(r.client_profile_id);
    const linkedAptStatus = r.matched_appointment_id ? apptStatus.get(r.matched_appointment_id) : null;
    const isReservedActive = r.status === 'matched'
      && r.reserved_until
      && new Date(r.reserved_until) > new Date()
      && !(linkedAptStatus === 'booked' || linkedAptStatus === 'confirmed' || linkedAptStatus === 'completed');
    const isBookedFromWaitlist = r.status === 'matched'
      && (linkedAptStatus === 'booked' || linkedAptStatus === 'confirmed' || linkedAptStatus === 'completed');

    return {
      id: r.id,
      client_name: (profile as { full_name?: string | null } | undefined)?.full_name ?? 'Клієнт',
      service_name: r.service_id ? (serviceById.get(r.service_id) ?? 'Послуга') : 'Будь-яка послуга',
      preferred_days: r.preferred_days ?? null,
      preferred_time_window: r.preferred_time_window ?? 'any',
      status: isBookedFromWaitlist ? 'booked' : (isReservedActive ? 'reserved' : (r.status === 'waiting' ? 'waiting' : 'expired')),
      reserved_until: r.reserved_until,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ entries: enriched });
}
