/** --- YAML
 * name: Waitlist Fill / Timeout Cron
 * description: Каждые 5 минут (Supabase pg_cron + cron-job.org redundancy):
 *              1) Откатывает истёкшие резервы — waitlist.status='matched' с
 *                 reserved_until < now() → проверяем не успел ли клиент
 *                 забронировать (matched_appointment_id поинтит на
 *                 booked/confirmed apt) → если нет, возвращаем status='waiting',
 *                 чистим reserved_until + notified_at.
 *              2) Для каждого освобождённого waitlist-record сразу зовём RPC
 *                 _waitlist_try_match для того же cancelled-apt → следующий
 *                 в очереди получает резерв.
 *              Сам матчинг — на стороне БД (helper _waitlist_try_match), здесь
 *              мы только триггерим повторный матчинг после истечения.
 *              Идемпотентен.
 * created: 2026-05-09
 * updated: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const maxDuration = 60;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface ExpiredEntry {
  id: string;
  master_id: string;
  matched_appointment_id: string | null;
}

interface AppointmentRow {
  id: string;
  status: string;
  master_id: string;
  service_id: string | null;
  starts_at: string;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const adm = admin();
  const nowIso = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // 1. Найти истёкшие резервы
  // ---------------------------------------------------------------------------
  const { data: expired } = await adm
    .from('waitlist')
    .select('id, master_id, matched_appointment_id')
    .eq('status', 'matched')
    .lt('reserved_until', nowIso) as { data: ExpiredEntry[] | null };

  if (!expired?.length) {
    return NextResponse.json({ ok: true, releasedReservations: 0, rematched: 0 });
  }

  // Подгружаем статусы matched_appointment_id чтобы понять — успел ли клиент
  // забронировать. Если apt в статусе booked/confirmed/completed — успел;
  // если в cancelled* — НЕ успел, slot всё ещё открыт.
  const aptIds = expired
    .map((e) => e.matched_appointment_id)
    .filter((x): x is string => Boolean(x));

  const { data: apts } = aptIds.length
    ? await adm
        .from('appointments')
        .select('id, status, master_id, service_id, starts_at')
        .in('id', aptIds) as { data: AppointmentRow[] | null }
    : { data: [] };

  const apptById = new Map<string, AppointmentRow>(
    (apts ?? []).map((a) => [a.id, a]),
  );

  // ---------------------------------------------------------------------------
  // 2. Для каждого истёкшего: освободить + попытаться передать следующему
  // ---------------------------------------------------------------------------
  const toRelease: string[] = [];
  const slotsToRematch: AppointmentRow[] = [];

  for (const e of expired) {
    const apt = e.matched_appointment_id ? apptById.get(e.matched_appointment_id) : null;
    const cancelStatuses = new Set(['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show']);
    const slotStillFree = apt && cancelStatuses.has(apt.status) && new Date(apt.starts_at) > new Date();

    if (apt && (apt.status === 'booked' || apt.status === 'confirmed' || apt.status === 'completed')) {
      // Клиент успел забронировать — резерв конвертируем в финальный matched.
      // (matched_appointment_id уже указывает на правильный apt — booking route
      // обновил его в /api/telegram/c/book когда увидел from_waitlist.)
      // Просто чистим reserved_until — статус 'matched' остаётся как «успешно».
      await adm
        .from('waitlist')
        .update({ reserved_until: null })
        .eq('id', e.id);
      continue;
    }

    // Резерв истёк, клиент НЕ забронировал — возвращаем в очередь.
    toRelease.push(e.id);
    if (slotStillFree) slotsToRematch.push(apt!);
  }

  if (toRelease.length) {
    await adm
      .from('waitlist')
      .update({
        status: 'waiting',
        reserved_until: null,
        notified_at: null,
        matched_appointment_id: null,
      })
      .in('id', toRelease);
  }

  // ---------------------------------------------------------------------------
  // 3. Передать освободившиеся слоты следующему в очереди
  // ---------------------------------------------------------------------------
  let rematched = 0;
  for (const apt of slotsToRematch) {
    const { data: matched } = await adm.rpc('_waitlist_try_match', {
      p_master_id: apt.master_id,
      p_service_id: apt.service_id,
      p_starts_at: apt.starts_at,
      p_apt_id: apt.id,
    });
    if (matched) rematched++;
  }

  return NextResponse.json({
    ok: true,
    releasedReservations: toRelease.length,
    rematched,
  });
}
