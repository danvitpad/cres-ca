/** --- YAML
 * name: Margin-by-service report
 * description: P&L breakdown — for each service the master sells, returns
 *   count of completed appointments, gross revenue (sum of paid prices),
 *   material cost (sum of inventory_usage at unit_cost), net profit and
 *   margin %. Period via ?from=&to= ISO dates. MAX-tier feature.
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json({ error: 'from/to required (ISO date)' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ rows: [] });

  // 1) appointments completed in period
  const { data: apts } = await supabase
    .from('appointments')
    .select('id, service_id, price, promo_discount_amount, bonus_redeemed, services(name)')
    .eq('master_id', master.id)
    .eq('status', 'completed')
    .gte('starts_at', from)
    .lte('starts_at', to);

  if (!apts?.length) return NextResponse.json({ rows: [] });

  type AptRow = {
    id: string;
    service_id: string | null;
    price: number | null;
    promo_discount_amount: number | null;
    bonus_redeemed: number | null;
    services: { name: string } | null;
  };
  const aptList = apts as unknown as AptRow[];
  const aptIds = aptList.map((a) => a.id).filter(Boolean);

  // 2) inventory_usage rows tied to those appointments — material cost
  const { data: usage } = await supabase
    .from('inventory_usage')
    .select('appointment_id, quantity_used, inventory_items(cost_per_unit)')
    .in('appointment_id', aptIds);

  type Use = { appointment_id: string; quantity_used: number; inventory_items: { cost_per_unit: number | null } | null };
  const useList = (usage ?? []) as unknown as Use[];

  const aptCost = new Map<string, number>();
  for (const u of useList) {
    const cost = Number(u.inventory_items?.cost_per_unit ?? 0) * Number(u.quantity_used ?? 0);
    aptCost.set(u.appointment_id, (aptCost.get(u.appointment_id) ?? 0) + cost);
  }

  // 3) aggregate by service. Revenue = price - promo_discount - bonus_redeemed
  type Bucket = { service_id: string; name: string; count: number; revenue: number; cost: number };
  const map = new Map<string, Bucket>();
  for (const a of aptList) {
    const sid = a.service_id ?? '__no_service__';
    const name = a.services?.name ?? 'Без услуги';
    const b = map.get(sid) ?? { service_id: sid, name, count: 0, revenue: 0, cost: 0 };
    const netRevenue =
      Number(a.price ?? 0) - Number(a.promo_discount_amount ?? 0) - Number(a.bonus_redeemed ?? 0);
    b.count += 1;
    b.revenue += Math.max(0, netRevenue);
    b.cost += aptCost.get(a.id) ?? 0;
    map.set(sid, b);
  }

  const rows = Array.from(map.values())
    .map((b) => ({
      service_id: b.service_id,
      name: b.name,
      count: b.count,
      revenue: Math.round(b.revenue),
      cost: Math.round(b.cost),
      profit: Math.round(b.revenue - b.cost),
      margin_pct: b.revenue > 0 ? Math.round(((b.revenue - b.cost) / b.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return NextResponse.json({ rows });
}
