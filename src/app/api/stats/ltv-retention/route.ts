/** --- YAML
 * name: LTV / Retention report
 * description: Per-master client analytics. Returns:
 *   - ltv_avg, ltv_median: average/median lifetime revenue per unique client
 *   - retention_rate: % of unique clients with 2+ completed visits
 *   - active_30d: % of clients who returned in the last 30 days
 *   - top_clients: 5 highest-LTV clients with visit counts and last visit
 *   - cohort_monthly: last 6 months — new clients each month and how many
 *     came back in any later month
 *   MAX-tier feature.
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ empty: true });

  // pull all completed appointments for this master — bounded list, fine for solo
  const { data: apts } = await supabase
    .from('appointments')
    .select('id, client_id, price, promo_discount_amount, bonus_redeemed, starts_at, clients(full_name)')
    .eq('master_id', master.id)
    .eq('status', 'completed')
    .order('starts_at', { ascending: true })
    .limit(5000);

  if (!apts?.length) {
    return NextResponse.json({
      ltv_avg: 0, ltv_median: 0,
      retention_rate: 0, active_30d: 0,
      top_clients: [], cohort_monthly: [],
      total_clients: 0, total_revenue: 0,
    });
  }

  type Apt = {
    id: string;
    client_id: string | null;
    price: number | null;
    promo_discount_amount: number | null;
    bonus_redeemed: number | null;
    starts_at: string;
    clients: { full_name: string | null } | null;
  };
  const list = apts as unknown as Apt[];

  // group by client
  type Group = { client_id: string; name: string; total: number; visits: number; first: string; last: string };
  const map = new Map<string, Group>();
  for (const a of list) {
    if (!a.client_id) continue;
    const net = Math.max(0,
      Number(a.price ?? 0) - Number(a.promo_discount_amount ?? 0) - Number(a.bonus_redeemed ?? 0)
    );
    const g = map.get(a.client_id) ?? {
      client_id: a.client_id,
      name: a.clients?.full_name ?? '—',
      total: 0, visits: 0, first: a.starts_at, last: a.starts_at,
    };
    g.total += net;
    g.visits += 1;
    if (a.starts_at < g.first) g.first = a.starts_at;
    if (a.starts_at > g.last) g.last = a.starts_at;
    map.set(a.client_id, g);
  }

  const groups = Array.from(map.values());
  const totalClients = groups.length;
  const totalRevenue = groups.reduce((s, g) => s + g.total, 0);
  const ltvAvg = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0;

  const sortedTotals = groups.map((g) => g.total).sort((a, b) => a - b);
  const ltvMedian = sortedTotals.length > 0
    ? Math.round(sortedTotals[Math.floor(sortedTotals.length / 2)])
    : 0;

  const repeatClients = groups.filter((g) => g.visits >= 2).length;
  const retentionRate = totalClients > 0
    ? Math.round((repeatClients / totalClients) * 100)
    : 0;

  const now = Date.now();
  const cutoff30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const active30d = groups.filter((g) => g.last >= cutoff30d).length;
  const active30dRate = totalClients > 0
    ? Math.round((active30d / totalClients) * 100)
    : 0;

  const topClients = groups
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((g) => ({
      client_id: g.client_id,
      name: g.name,
      total: Math.round(g.total),
      visits: g.visits,
      last: g.last,
    }));

  // Cohort: last 6 months. For each month — count new clients (first visit
  // in that month) and how many of them returned in any later month.
  const cohortMap = new Map<string, { new_count: number; returned: number }>();
  const monthsBack = 6;
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    cohortMap.set(key, { new_count: 0, returned: 0 });
  }

  for (const g of groups) {
    const firstD = new Date(g.first);
    const firstKey = `${firstD.getFullYear()}-${String(firstD.getMonth() + 1).padStart(2, '0')}`;
    if (!cohortMap.has(firstKey)) continue;
    const bucket = cohortMap.get(firstKey)!;
    bucket.new_count += 1;
    if (g.visits >= 2) bucket.returned += 1;
  }

  const cohortMonthly = Array.from(cohortMap.entries()).map(([month, v]) => ({
    month,
    new_count: v.new_count,
    returned: v.returned,
    return_rate: v.new_count > 0 ? Math.round((v.returned / v.new_count) * 100) : 0,
  }));

  return NextResponse.json({
    ltv_avg: ltvAvg,
    ltv_median: ltvMedian,
    retention_rate: retentionRate,
    active_30d: active30dRate,
    top_clients: topClients,
    cohort_monthly: cohortMonthly,
    total_clients: totalClients,
    total_revenue: Math.round(totalRevenue),
  });
}
