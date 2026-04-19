/** --- YAML
 * name: Superadmin platform metrics
 * description: Server-only aggregate queries for /superadmin/dashboard — counters with weekly delta, MRR/ARR/Churn/ARPU, activity, 12-month MRR series, 30-day registrations series, recent events feed.
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface CounterBlock {
  users: { total: number; weekDelta: number };
  masters: { total: number; weekDelta: number };
  salons: { total: number; weekDelta: number };
  clients: { total: number; weekDelta: number };
}

export interface FinanceBlock {
  mrr: number;
  arr: number;
  churnPercent: number;
  arpu: number;
  activeSubs: number;
}

export interface ActivityBlock {
  appointmentsCreated30d: number;
  appointmentsCompleted30d: number;
  voiceActions30d: number;
  reviews30d: number;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface RegistrationPoint {
  date: string;
  clients: number;
  masters: number;
  salons: number;
}

export interface EventItem {
  at: string;
  kind: 'profile' | 'subscription' | 'subscription_cancel' | 'salon';
  title: string;
  subtitle: string;
}

function weekAgo() {
  return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
}

function monthsAgo(n: number) {
  return new Date(Date.now() - n * 30 * 24 * 3600 * 1000).toISOString();
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
}

async function countAndDelta(table: string, weekIso: string, filter?: { col: string; eq: string }): Promise<{ total: number; weekDelta: number }> {
  const db = admin();
  let q1 = db.from(table).select('id', { count: 'exact', head: true });
  let q2 = db.from(table).select('id', { count: 'exact', head: true }).gte('created_at', weekIso);
  if (filter) {
    q1 = q1.eq(filter.col, filter.eq);
    q2 = q2.eq(filter.col, filter.eq);
  }
  const [t, w] = await Promise.all([q1, q2]);
  return { total: t.count ?? 0, weekDelta: w.count ?? 0 };
}

export async function getCounters(): Promise<CounterBlock> {
  const w = weekAgo();
  const [users, masters, salons, clients] = await Promise.all([
    countAndDelta('profiles', w),
    countAndDelta('masters', w),
    countAndDelta('salons', w),
    countAndDelta('clients', w),
  ]);
  return { users, masters, salons, clients };
}

export async function getFinance(): Promise<FinanceBlock> {
  const db = admin();
  const { data: subs } = await db
    .from('subscriptions')
    .select('id, tier, status, billing_period, plan_id, subscription_plans:plan_id(price_monthly, price_yearly)')
    .eq('status', 'active');

  let mrr = 0;
  let activeSubs = 0;
  type Row = {
    tier: string;
    billing_period: string | null;
    subscription_plans: { price_monthly: number | null; price_yearly: number | null } | null;
  };
  for (const s of (subs ?? []) as unknown as Row[]) {
    if (s.tier === 'trial') continue;
    const plan = s.subscription_plans;
    if (!plan) continue;
    const monthly = Number(plan.price_monthly ?? 0);
    const yearly = Number(plan.price_yearly ?? 0);
    const contribution = s.billing_period === 'yearly' && yearly > 0 ? yearly / 12 : monthly;
    mrr += contribution;
    activeSubs += 1;
  }

  const since = daysAgo(30);
  const [{ count: cancelled }, { count: activeAtStart }] = await Promise.all([
    db
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('cancelled_at', since),
    db
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('created_at', since),
  ]);
  const churnPercent = (activeAtStart ?? 0) > 0 ? ((cancelled ?? 0) / (activeAtStart ?? 1)) * 100 : 0;
  const arpu = activeSubs > 0 ? mrr / activeSubs : 0;

  return { mrr: Math.round(mrr), arr: Math.round(mrr * 12), churnPercent: Number(churnPercent.toFixed(2)), arpu: Math.round(arpu), activeSubs };
}

export async function getActivity(): Promise<ActivityBlock> {
  const db = admin();
  const since = daysAgo(30);
  const [created, completed, voice, reviews] = await Promise.all([
    db.from('appointments').select('id', { count: 'exact', head: true }).gte('created_at', since),
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('created_at', since),
    db.from('ai_actions_log').select('id', { count: 'exact', head: true }).eq('source', 'voice').gte('created_at', since),
    db.from('reviews').select('id', { count: 'exact', head: true }).gte('created_at', since),
  ]);
  return {
    appointmentsCreated30d: created.count ?? 0,
    appointmentsCompleted30d: completed.count ?? 0,
    voiceActions30d: voice.count ?? 0,
    reviews30d: reviews.count ?? 0,
  };
}

export async function getMrrSeries(): Promise<ChartPoint[]> {
  const db = admin();
  const { data: subs } = await db
    .from('subscriptions')
    .select('tier, billing_period, status, created_at, cancelled_at, subscription_plans:plan_id(price_monthly, price_yearly)');

  type Row = {
    tier: string;
    billing_period: string | null;
    status: string;
    created_at: string;
    cancelled_at: string | null;
    subscription_plans: { price_monthly: number | null; price_yearly: number | null } | null;
  };
  const rows = (subs ?? []) as unknown as Row[];

  const out: ChartPoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let mrr = 0;
    for (const s of rows) {
      if (s.tier === 'trial') continue;
      if (!s.subscription_plans) continue;
      const created = new Date(s.created_at);
      const cancelled = s.cancelled_at ? new Date(s.cancelled_at) : null;
      if (created > monthEnd) continue;
      if (cancelled && cancelled < monthStart) continue;
      const monthly = Number(s.subscription_plans.price_monthly ?? 0);
      const yearly = Number(s.subscription_plans.price_yearly ?? 0);
      mrr += s.billing_period === 'yearly' && yearly > 0 ? yearly / 12 : monthly;
    }
    const label = monthStart.toLocaleString('ru-RU', { month: 'short' });
    out.push({ label, value: Math.round(mrr) });
  }
  return out;
}

export async function getRegistrationsSeries(): Promise<RegistrationPoint[]> {
  const db = admin();
  const since = daysAgo(30);
  const [p, m, s] = await Promise.all([
    db.from('profiles').select('created_at, role').gte('created_at', since),
    db.from('masters').select('created_at').gte('created_at', since),
    db.from('salons').select('created_at').gte('created_at', since),
  ]);
  const map = new Map<string, { clients: number; masters: number; salons: number }>();
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { clients: 0, masters: 0, salons: 0 });
  }
  for (const row of (p.data ?? []) as Array<{ created_at: string; role: string }>) {
    const key = row.created_at.slice(0, 10);
    const b = map.get(key);
    if (!b) continue;
    if (row.role === 'client') b.clients += 1;
    if (row.role === 'master') b.masters += 1;
  }
  // masters / salons tables — extra signal for masters/salons onboarded (separate events)
  for (const row of (m.data ?? []) as Array<{ created_at: string }>) {
    const key = row.created_at.slice(0, 10);
    const b = map.get(key);
    if (b && b.masters === 0) b.masters += 1;
  }
  for (const row of (s.data ?? []) as Array<{ created_at: string }>) {
    const key = row.created_at.slice(0, 10);
    const b = map.get(key);
    if (b) b.salons += 1;
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, clients: v.clients, masters: v.masters, salons: v.salons }));
}

export async function getRecentEvents(limit = 15): Promise<EventItem[]> {
  const db = admin();
  const events: EventItem[] = [];

  const [profs, subs, cancels, sls] = await Promise.all([
    db.from('profiles').select('full_name, first_name, role, created_at').order('created_at', { ascending: false }).limit(10),
    db.from('subscriptions').select('tier, created_at, profile_id, profiles:profile_id(full_name, first_name)').neq('tier', 'trial').order('created_at', { ascending: false }).limit(10),
    db.from('subscriptions').select('tier, cancelled_at, cancel_reason, profile_id, profiles:profile_id(full_name, first_name)').eq('status', 'cancelled').not('cancelled_at', 'is', null).order('cancelled_at', { ascending: false }).limit(10),
    db.from('salons').select('name, city, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  type ProfRef = { full_name: string | null; first_name: string | null };
  const pickName = (p: ProfRef | ProfRef[] | null | undefined): string => {
    const one = Array.isArray(p) ? p[0] : p;
    return one?.full_name || one?.first_name || '—';
  };

  for (const row of (profs.data ?? []) as Array<{ full_name: string | null; first_name: string | null; role: string; created_at: string }>) {
    const name = row.full_name || row.first_name || 'Без имени';
    events.push({
      at: row.created_at,
      kind: 'profile',
      title: `Новый ${row.role === 'master' ? 'мастер' : row.role === 'salon_admin' ? 'админ салона' : 'пользователь'}: ${name}`,
      subtitle: '',
    });
  }
  for (const row of (subs.data ?? []) as unknown as Array<{ tier: string; created_at: string; profiles: ProfRef | ProfRef[] | null }>) {
    events.push({ at: row.created_at, kind: 'subscription', title: `Подписка ${row.tier}: ${pickName(row.profiles)}`, subtitle: '' });
  }
  for (const row of (cancels.data ?? []) as unknown as Array<{ tier: string; cancelled_at: string; cancel_reason: string | null; profiles: ProfRef | ProfRef[] | null }>) {
    events.push({
      at: row.cancelled_at,
      kind: 'subscription_cancel',
      title: `Отмена подписки ${row.tier}: ${pickName(row.profiles)}`,
      subtitle: row.cancel_reason ? `причина: "${row.cancel_reason}"` : '',
    });
  }
  for (const row of (sls.data ?? []) as Array<{ name: string; city: string | null; created_at: string }>) {
    events.push({ at: row.created_at, kind: 'salon', title: `Новый салон: ${row.name}`, subtitle: row.city || '' });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  return events.slice(0, limit);
}

export async function getDashboardData() {
  const [counters, finance, activity, mrrSeries, regSeries, events] = await Promise.all([
    getCounters(),
    getFinance(),
    getActivity(),
    getMrrSeries(),
    getRegistrationsSeries(),
    getRecentEvents(15),
  ]);
  return { counters, finance, activity, mrrSeries, regSeries, events };
}
