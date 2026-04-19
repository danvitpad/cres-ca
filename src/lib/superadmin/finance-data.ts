/** --- YAML
 * name: Superadmin finance data
 * description: Platform finance aggregates — MRR/ARR, per-plan breakdown, new/churned MRR for current month, LTV, churn reasons, 12-month MRR series, prognosis.
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

export interface FinancePlanBreakdown {
  tier: string;
  monthly: { count: number; unit: number; total: number };
  yearly: { count: number; unit: number; total: number };
  totalMrr: number;
}

export interface ChurnReasonRow {
  reason: string;
  count: number;
}

export interface MrrPoint {
  label: string;
  mrr: number;
}

export interface FinanceSnapshot {
  mrr: number;
  arr: number;
  activeSubs: number;
  whitelistCount: number;
  arpu: number;
  newMrr: number;
  churnedMrr: number;
  netNewMrr: number;
  churnPercent: number;
  churnedCount: number;
  planBreakdown: FinancePlanBreakdown[];
  mrrSeries: MrrPoint[];
  churnReasons: ChurnReasonRow[];
  ltvMaster: number;
  ltvSalon: number;
  prognosis: {
    sixMonthMrr: number;
    monthlyGrowthRate: number;
    proNeededFor10k: number;
    businessNeededFor10k: number;
  };
}

interface SubRow {
  tier: string;
  status: string;
  billing_period: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  subscription_plans: { tier: string; price_monthly: number | null; price_yearly: number | null } | null;
}

function monthlyContribution(s: SubRow): number {
  const monthly = Number(s.subscription_plans?.price_monthly ?? 0);
  const yearly = Number(s.subscription_plans?.price_yearly ?? 0);
  return s.billing_period === 'yearly' && yearly > 0 ? yearly / 12 : monthly;
}

export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const db = admin();

  const { data: subs } = await db
    .from('subscriptions')
    .select('tier, status, billing_period, created_at, cancelled_at, cancel_reason, subscription_plans:plan_id(tier, price_monthly, price_yearly)');

  const rows = (subs ?? []) as unknown as SubRow[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let mrr = 0;
  let activeSubs = 0;
  let newMrr = 0;
  let churnedMrr = 0;
  let churnedCount = 0;

  const planMap = new Map<string, FinancePlanBreakdown>();

  for (const s of rows) {
    const tier = s.subscription_plans?.tier ?? s.tier;
    if (!planMap.has(tier)) {
      planMap.set(tier, {
        tier,
        monthly: { count: 0, unit: Number(s.subscription_plans?.price_monthly ?? 0), total: 0 },
        yearly: { count: 0, unit: Number(s.subscription_plans?.price_yearly ?? 0), total: 0 },
        totalMrr: 0,
      });
    }

    const active = s.status === 'active' && s.tier !== 'trial';
    if (active) {
      const contrib = monthlyContribution(s);
      mrr += contrib;
      activeSubs += 1;
      const plan = planMap.get(tier)!;
      if (s.billing_period === 'yearly') {
        plan.yearly.count += 1;
        plan.yearly.total += contrib;
      } else {
        plan.monthly.count += 1;
        plan.monthly.total += contrib;
      }
      plan.totalMrr += contrib;

      const created = new Date(s.created_at);
      if (created >= monthStart) newMrr += contrib;
    }

    if (s.status === 'cancelled' && s.cancelled_at) {
      const cancelled = new Date(s.cancelled_at);
      if (cancelled >= monthStart) {
        churnedMrr += monthlyContribution(s);
        churnedCount += 1;
      }
    }
  }

  const arr = Math.round(mrr * 12);
  const arpu = activeSubs > 0 ? mrr / activeSubs : 0;

  // Churn %: cancelled this month / active at start of month
  let activeAtMonthStart = 0;
  for (const s of rows) {
    const tier = s.tier;
    if (tier === 'trial') continue;
    if (!s.subscription_plans) continue;
    const created = new Date(s.created_at);
    if (created > monthStart) continue;
    const cancelled = s.cancelled_at ? new Date(s.cancelled_at) : null;
    if (cancelled && cancelled < monthStart) continue;
    activeAtMonthStart += 1;
  }
  const churnPercent = activeAtMonthStart > 0 ? (churnedCount / activeAtMonthStart) * 100 : 0;

  // Churn reasons (last 90 days)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const reasonCounts = new Map<string, number>();
  for (const s of rows) {
    if (s.status !== 'cancelled' || !s.cancelled_at) continue;
    const c = new Date(s.cancelled_at);
    if (c < ninetyDaysAgo) continue;
    const key = (s.cancel_reason || 'не указано').trim();
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const churnReasons: ChurnReasonRow[] = Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  // MRR series — 12 months
  const mrrSeries: MrrPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let pointMrr = 0;
    for (const s of rows) {
      if (s.tier === 'trial') continue;
      if (!s.subscription_plans) continue;
      const created = new Date(s.created_at);
      const cancelled = s.cancelled_at ? new Date(s.cancelled_at) : null;
      if (created > mEnd) continue;
      if (cancelled && cancelled < mStart) continue;
      pointMrr += monthlyContribution(s);
    }
    mrrSeries.push({ label: mStart.toLocaleString('ru-RU', { month: 'short' }), mrr: Math.round(pointMrr) });
  }

  // Whitelist count
  const { count: whitelistCount } = await db.from('platform_whitelist').select('id', { count: 'exact', head: true });

  // LTV (assume 12-month average retention — simple heuristic)
  const proMonthly = Number(rows.find((r) => r.subscription_plans?.tier === 'pro')?.subscription_plans?.price_monthly ?? 799);
  const businessMonthly = Number(rows.find((r) => r.subscription_plans?.tier === 'business')?.subscription_plans?.price_monthly ?? 1999);
  const ltvMaster = proMonthly * 12;
  const ltvSalon = businessMonthly * 12;

  // Prognosis
  const lastMonthMrr = mrrSeries[mrrSeries.length - 2]?.mrr ?? mrr;
  const growthRate = lastMonthMrr > 0 ? (mrr - lastMonthMrr) / lastMonthMrr : 0;
  const sixMonthMrr = Math.round(mrr * Math.pow(1 + growthRate, 6));
  const targetUsd = 10_000;
  const uahPerUsd = 40;
  const targetMrr = targetUsd * uahPerUsd;
  const proNeededFor10k = proMonthly > 0 ? Math.ceil(targetMrr / proMonthly) : 0;
  const businessNeededFor10k = businessMonthly > 0 ? Math.ceil(targetMrr / businessMonthly) : 0;

  // Avoid unused monthlyContribution warning
  void prevMonthStart;

  return {
    mrr: Math.round(mrr),
    arr,
    activeSubs,
    whitelistCount: whitelistCount ?? 0,
    arpu: Math.round(arpu),
    newMrr: Math.round(newMrr),
    churnedMrr: Math.round(churnedMrr),
    netNewMrr: Math.round(newMrr - churnedMrr),
    churnPercent: Number(churnPercent.toFixed(2)),
    churnedCount,
    planBreakdown: Array.from(planMap.values())
      .filter((p) => p.monthly.count + p.yearly.count > 0)
      .sort((a, b) => b.totalMrr - a.totalMrr)
      .map((p) => ({
        ...p,
        monthly: { ...p.monthly, total: Math.round(p.monthly.total) },
        yearly: { ...p.yearly, total: Math.round(p.yearly.total) },
        totalMrr: Math.round(p.totalMrr),
      })),
    mrrSeries,
    churnReasons,
    ltvMaster,
    ltvSalon,
    prognosis: {
      sixMonthMrr,
      monthlyGrowthRate: Number((growthRate * 100).toFixed(1)),
      proNeededFor10k,
      businessNeededFor10k,
    },
  };
}
