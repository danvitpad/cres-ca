/** --- YAML
 * name: AI Concierge Tools
 * description: Server-side helpers, которые AI-консьерж клиента вызывает
 *              через свои intent'ы. Каждая функция читает БД и возвращает
 *              структурированный результат: список слотов, статистику,
 *              историю визитов, оценку интервала «когда обычно делать X».
 *              AI потом формулирует естественный ответ из этих данных.
 * created: 2026-05-06
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type WorkingDay,
  type WeekDayKey,
  WEEK_DAY_KEYS,
} from '@/types/working-hours';
import { normalizeWithDefault } from '@/lib/working-hours/normalize';

const t2m = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const m2t = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const dayKeyFromIso = (isoDate: string): WeekDayKey => {
  // isoDate = "YYYY-MM-DD". JS: 0=Sunday → array starts monday.
  const d = new Date(`${isoDate}T00:00:00`);
  return WEEK_DAY_KEYS[(d.getDay() + 6) % 7];
};

interface BusyRange { start: number; end: number }

/**
 * Свободные слоты у мастера на конкретную дату для услуги указанной длительности.
 * Учитывает мульти-интервальное расписание, существующие записи, blocked_times,
 * is_busy. Возвращает только те, в которые услуга помещается полностью.
 *
 * Возвращает массив строк "HH:MM" с шагом 30 мин.
 */
export async function findFreeSlotsInDay(
  db: SupabaseClient,
  params: {
    masterId: string;
    date: string; // YYYY-MM-DD
    durationMinutes: number;
    afterTime?: string | null; // например "14:00" — «после обеда»
  },
): Promise<string[]> {
  const { data: master } = await db
    .from('masters')
    .select('working_hours, is_busy, busy_until')
    .eq('id', params.masterId)
    .maybeSingle<{ working_hours: unknown; is_busy: boolean | null; busy_until: string | null }>();
  if (!master) return [];

  const wh = normalizeWithDefault(master.working_hours);
  const day: WorkingDay = wh[dayKeyFromIso(params.date)];
  if (!day.enabled || !day.intervals.length) return [];

  // is_busy режим
  if (master.is_busy) {
    const until = master.busy_until ? new Date(master.busy_until) : null;
    if (!until || until > new Date(`${params.date}T00:00:00`)) return [];
  }

  const dayStart = `${params.date}T00:00:00`;
  const dayEnd = `${params.date}T23:59:59`;

  const [{ data: appts }, { data: blocks }] = await Promise.all([
    db.from('appointments')
      .select('starts_at, ends_at')
      .eq('master_id', params.masterId)
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)
      .not('status', 'in', '("cancelled","cancelled_by_client","cancelled_by_master","no_show")'),
    db.from('blocked_times')
      .select('starts_at, ends_at')
      .eq('master_id', params.masterId)
      .lte('starts_at', dayEnd)
      .gte('ends_at', dayStart),
  ]);

  const busy: BusyRange[] = [];
  for (const a of (appts ?? []) as Array<{ starts_at: string; ends_at: string }>) {
    busy.push({
      start: t2m(new Date(a.starts_at).toTimeString().slice(0, 5)),
      end: t2m(new Date(a.ends_at).toTimeString().slice(0, 5)),
    });
  }
  for (const b of (blocks ?? []) as Array<{ starts_at: string; ends_at: string }>) {
    busy.push({
      start: t2m(new Date(b.starts_at).toTimeString().slice(0, 5)),
      end: t2m(new Date(b.ends_at).toTimeString().slice(0, 5)),
    });
  }

  // На «сегодня» отбрасываем уже прошедшие времена + 15 мин буфер
  const kyivNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
  const todayStr = `${kyivNow.getFullYear()}-${String(kyivNow.getMonth() + 1).padStart(2, '0')}-${String(kyivNow.getDate()).padStart(2, '0')}`;
  const isToday = params.date === todayStr;
  const earliestNow = isToday ? kyivNow.getHours() * 60 + kyivNow.getMinutes() + 15 : -1;
  const afterMin = params.afterTime ? t2m(params.afterTime) : -1;

  const out: string[] = [];
  for (const iv of day.intervals) {
    const startMin = t2m(iv.start);
    const endMin = t2m(iv.end);
    for (let t = startMin; t + params.durationMinutes <= endMin; t += 30) {
      if (t < earliestNow) continue;
      if (t < afterMin) continue;
      const conflict = busy.some(
        (br) => t < br.end && t + params.durationMinutes > br.start,
      );
      if (conflict) continue;
      out.push(m2t(t));
    }
  }
  return out;
}

/**
 * Ближайшие N дней с любым свободным слотом для услуги у мастера. Используется
 * когда AI хочет показать «вот ближайшие 3 дня где есть окно».
 */
export async function findNextAvailableSlots(
  db: SupabaseClient,
  params: {
    masterId: string;
    durationMinutes: number;
    horizonDays?: number;
    perDayLimit?: number;
  },
): Promise<Array<{ date: string; slots: string[] }>> {
  const horizon = params.horizonDays ?? 14;
  const perDay = params.perDayLimit ?? 3;
  const today = new Date();
  const out: Array<{ date: string; slots: string[] }> = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const slots = await findFreeSlotsInDay(db, {
      masterId: params.masterId,
      date: dateStr,
      durationMinutes: params.durationMinutes,
    });
    if (slots.length) out.push({ date: dateStr, slots: slots.slice(0, perDay) });
    if (out.length >= 3) break; // достаточно 3 ближайших дней с окнами
  }
  return out;
}

/**
 * Статистика клиента за период — сумма, кол-во визитов, разбивка по услугам.
 */
export async function getClientStats(
  db: SupabaseClient,
  profileId: string,
  opts: { from?: string; serviceQuery?: string | null } = {},
): Promise<{
  totalSpent: number;
  currency: string;
  visits: number;
  byService: Array<{ name: string; count: number; spent: number }>;
}> {
  // Найти client_id'ы этого профиля у разных мастеров (один профиль может
  // быть клиентом у нескольких мастеров).
  const { data: clientLinks } = await db
    .from('clients')
    .select('id')
    .eq('profile_id', profileId);
  const clientIds = (clientLinks ?? []).map((c) => c.id as string);
  if (!clientIds.length) {
    return { totalSpent: 0, currency: 'UAH', visits: 0, byService: [] };
  }

  let q = db
    .from('appointments')
    .select('price, currency, service:services(name)')
    .in('client_id', clientIds)
    .eq('status', 'completed');
  if (opts.from) q = q.gte('starts_at', opts.from);

  const { data: rows } = await q;
  type Row = { price: number | null; currency: string | null; service: { name: string | null } | { name: string | null }[] | null };
  const list = (rows ?? []) as Row[];

  const byService = new Map<string, { count: number; spent: number }>();
  let totalSpent = 0;
  let currency = 'UAH';
  let visits = 0;
  for (const r of list) {
    const svc = Array.isArray(r.service) ? r.service[0] : r.service;
    const name = svc?.name ?? '';
    if (opts.serviceQuery && name) {
      if (!name.toLowerCase().includes(opts.serviceQuery.toLowerCase())) continue;
    }
    visits += 1;
    const price = Number(r.price ?? 0);
    totalSpent += price;
    if (r.currency) currency = r.currency;
    if (name) {
      const cur = byService.get(name) ?? { count: 0, spent: 0 };
      cur.count += 1;
      cur.spent += price;
      byService.set(name, cur);
    }
  }
  const top = Array.from(byService.entries())
    .map(([name, v]) => ({ name, count: v.count, spent: v.spent }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
  return { totalSpent, currency, visits, byService: top };
}

/**
 * Последние N завершённых визитов клиента — для «покажи мою историю».
 */
export async function getClientHistory(
  db: SupabaseClient,
  profileId: string,
  limit = 10,
): Promise<Array<{
  id: string;
  starts_at: string;
  service_name: string | null;
  master_name: string | null;
  price: number | null;
  currency: string | null;
}>> {
  const { data: clientLinks } = await db
    .from('clients')
    .select('id')
    .eq('profile_id', profileId);
  const clientIds = (clientLinks ?? []).map((c) => c.id as string);
  if (!clientIds.length) return [];

  const { data: rows } = await db
    .from('appointments')
    .select('id, starts_at, price, currency, service:services(name), master:masters(display_name, profile:profiles!masters_profile_id_fkey(full_name))')
    .in('client_id', clientIds)
    .eq('status', 'completed')
    .order('starts_at', { ascending: false })
    .limit(limit);

  type Row = {
    id: string;
    starts_at: string;
    price: number | null;
    currency: string | null;
    service: { name: string | null } | { name: string | null }[] | null;
    master:
      | { display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }
      | { display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }[]
      | null;
  };

  return ((rows ?? []) as Row[]).map((r) => {
    const svc = Array.isArray(r.service) ? r.service[0] : r.service;
    const master = Array.isArray(r.master) ? r.master[0] : r.master;
    const masterProfile = master ? (Array.isArray(master.profile) ? master.profile[0] : master.profile) : null;
    return {
      id: r.id,
      starts_at: r.starts_at,
      service_name: svc?.name ?? null,
      master_name: master?.display_name ?? masterProfile?.full_name ?? null,
      price: r.price,
      currency: r.currency,
    };
  });
}

/**
 * Оценка «когда мне обычно делать X». Берём последние 6 завершённых визитов
 * клиента по услуге (имя ilike), считаем медианный интервал между ними.
 * Возвращаем дату следующего визита (последний + медиана) и сколько дней
 * с прошлого визита.
 */
export async function getNextDueEstimate(
  db: SupabaseClient,
  profileId: string,
  serviceQuery: string,
): Promise<{
  lastVisit: string | null;
  nextDue: string | null;
  intervalDays: number | null;
  basedOnVisits: number;
} | null> {
  const { data: clientLinks } = await db
    .from('clients')
    .select('id')
    .eq('profile_id', profileId);
  const clientIds = (clientLinks ?? []).map((c) => c.id as string);
  if (!clientIds.length) return null;

  const { data: rows } = await db
    .from('appointments')
    .select('starts_at, service:services(name)')
    .in('client_id', clientIds)
    .eq('status', 'completed')
    .order('starts_at', { ascending: false })
    .limit(20);
  type Row = { starts_at: string; service: { name: string | null } | { name: string | null }[] | null };
  const matched = ((rows ?? []) as Row[])
    .filter((r) => {
      const svc = Array.isArray(r.service) ? r.service[0] : r.service;
      return svc?.name?.toLowerCase().includes(serviceQuery.toLowerCase()) ?? false;
    })
    .map((r) => new Date(r.starts_at))
    .sort((a, b) => b.getTime() - a.getTime());

  if (matched.length < 2) {
    if (matched.length === 1) {
      return {
        lastVisit: matched[0].toISOString(),
        nextDue: null,
        intervalDays: null,
        basedOnVisits: 1,
      };
    }
    return null;
  }

  // Интервалы (в днях) между соседними визитами, отсортированными от свежих к старым
  const intervals: number[] = [];
  for (let i = 0; i < matched.length - 1; i++) {
    intervals.push((matched[i].getTime() - matched[i + 1].getTime()) / 86_400_000);
  }
  intervals.sort((a, b) => a - b);
  const median =
    intervals.length % 2 === 0
      ? (intervals[intervals.length / 2 - 1] + intervals[intervals.length / 2]) / 2
      : intervals[Math.floor(intervals.length / 2)];

  const last = matched[0];
  const next = new Date(last.getTime() + median * 86_400_000);

  return {
    lastVisit: last.toISOString(),
    nextDue: next.toISOString(),
    intervalDays: Math.round(median),
    basedOnVisits: matched.length,
  };
}

/**
 * Резолвер мастера по имени — ищем сначала в подписках клиента, потом по всем
 * публичным мастерам. Возвращает либо ID, либо список вариантов для уточнения.
 */
export async function resolveMaster(
  db: SupabaseClient,
  params: { profileId?: string | null; query: string },
): Promise<
  | { kind: 'exact'; masterId: string }
  | { kind: 'choices'; options: Array<{ id: string; name: string }> }
  | { kind: 'none' }
> {
  const q = params.query.trim().toLowerCase();
  if (!q) return { kind: 'none' };

  // Шаг 1 — followed мастера клиента (если есть)
  if (params.profileId) {
    const { data: links } = await db
      .from('client_master_links')
      .select('masters:masters!client_master_links_master_id_fkey(id, display_name, profiles:profiles!masters_profile_id_fkey(full_name))')
      .eq('profile_id', params.profileId);
    type MasterEntry = {
      id: string;
      display_name: string | null;
      profiles: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    type Row = { masters: MasterEntry | MasterEntry[] | null };
    const followed = (((links ?? []) as unknown) as Row[])
      .flatMap((l) => Array.isArray(l.masters) ? l.masters : (l.masters ? [l.masters] : []));
    const matches = followed.filter((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const name = (m.display_name || profile?.full_name || '').toLowerCase();
      return name.includes(q);
    });
    if (matches.length === 1) return { kind: 'exact', masterId: matches[0].id };
    if (matches.length > 1) {
      return {
        kind: 'choices',
        options: matches.slice(0, 5).map((m) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return { id: m.id, name: m.display_name ?? profile?.full_name ?? '—' };
        }),
      };
    }
  }

  // Шаг 2 — общая база (только для exact, не подменяем выбор клиента)
  const { data: all } = await db
    .from('masters')
    .select('id, display_name, profiles:profiles!masters_profile_id_fkey(full_name)')
    .eq('is_public', true)
    .eq('is_active', true)
    .limit(50);
  type Row2 = {
    id: string;
    display_name: string | null;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  };
  const matches = ((all ?? []) as Row2[]).filter((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const name = (m.display_name || profile?.full_name || '').toLowerCase();
    return name.includes(q);
  });
  if (matches.length === 1) return { kind: 'exact', masterId: matches[0].id };
  if (matches.length > 1) {
    return {
      kind: 'choices',
      options: matches.slice(0, 5).map((m) => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return { id: m.id, name: m.display_name ?? profile?.full_name ?? '—' };
      }),
    };
  }
  return { kind: 'none' };
}

/**
 * Резолвер услуги у конкретного мастера по тексту.
 */
export async function resolveService(
  db: SupabaseClient,
  params: { masterId: string; query: string },
): Promise<
  | { kind: 'exact'; serviceId: string; name: string; durationMinutes: number; price: number; currency: string }
  | { kind: 'choices'; options: Array<{ id: string; name: string; durationMinutes: number; price: number; currency: string }> }
  | { kind: 'none' }
> {
  const { data } = await db
    .from('services')
    .select('id, name, duration_minutes, price, currency')
    .eq('master_id', params.masterId)
    .eq('is_active', true);
  const list = (data ?? []) as Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
    currency: string;
  }>;

  const q = params.query.trim().toLowerCase();
  const matches = list.filter((s) => s.name.toLowerCase().includes(q));
  if (matches.length === 1) {
    const m = matches[0];
    return {
      kind: 'exact',
      serviceId: m.id,
      name: m.name,
      durationMinutes: m.duration_minutes,
      price: m.price,
      currency: m.currency,
    };
  }
  if (matches.length > 1) {
    return {
      kind: 'choices',
      options: matches.slice(0, 5).map((m) => ({
        id: m.id,
        name: m.name,
        durationMinutes: m.duration_minutes,
        price: m.price,
        currency: m.currency,
      })),
    };
  }
  return { kind: 'none' };
}
