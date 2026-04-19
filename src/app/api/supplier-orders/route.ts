/** --- YAML
 * name: Supplier orders API
 * description: GET — список заказов + рекомендации low-stock по поставщикам. POST — создать draft-заказ.
 * created: 2026-04-19
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
  if (!master) return NextResponse.json({ orders: [], recommendations: [] });

  const [{ data: orders }, { data: inv }, { data: suppliers }] = await Promise.all([
    supabase
      .from('supplier_orders')
      .select('id, supplier_id, status, total_cost, currency, created_at, sent_at, delivered_at, items')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('inventory_items')
      .select('id, name, quantity, low_stock_threshold, unit, cost_per_unit, preferred_supplier_id')
      .eq('master_id', master.id),
    supabase
      .from('suppliers')
      .select('id, name, phone, email')
      .eq('master_id', master.id)
      .eq('is_active', true),
  ]);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s]));
  const supplierNames: Record<string, string> = {};
  (suppliers ?? []).forEach((s) => { supplierNames[s.id] = s.name; });

  const grouped: Record<string, { supplier_id: string | null; supplier_name: string; items: Array<{ id: string; name: string; quantity: number; unit: string; threshold: number; shortfall: number; cost_per_unit: number }> }> = {};
  (inv ?? []).forEach((it) => {
    const q = Number(it.quantity ?? 0);
    const thr = Number(it.low_stock_threshold ?? 0);
    if (q > thr) return;
    const sid = it.preferred_supplier_id ?? '__none__';
    const sname = supplierMap.get(sid)?.name ?? 'Без поставщика';
    if (!grouped[sid]) grouped[sid] = { supplier_id: it.preferred_supplier_id ?? null, supplier_name: sname, items: [] };
    grouped[sid].items.push({
      id: it.id,
      name: it.name,
      quantity: q,
      unit: it.unit,
      threshold: thr,
      shortfall: Math.max(0, thr - q + thr),
      cost_per_unit: Number(it.cost_per_unit ?? 0),
    });
  });

  return NextResponse.json({
    orders: (orders ?? []).map((o) => ({ ...o, supplier_name: o.supplier_id ? supplierNames[o.supplier_id] ?? null : null })),
    recommendations: Object.values(grouped),
    suppliers: suppliers ?? [],
  });
}

interface PostBody {
  supplier_id: string | null;
  items: Array<{ name: string; quantity: number; unit: string; unit_price: number }>;
  note?: string | null;
  currency?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'no master profile' }, { status: 400 });

  const body = (await req.json()) as PostBody;
  if (!body.items?.length) return NextResponse.json({ error: 'no items' }, { status: 400 });

  const items = body.items.map((it) => ({
    ...it,
    total: Number((it.quantity * it.unit_price).toFixed(2)),
  }));
  const total = items.reduce((s, it) => s + it.total, 0);

  const { data, error } = await supabase
    .from('supplier_orders')
    .insert({
      master_id: master.id,
      supplier_id: body.supplier_id,
      status: 'draft',
      items,
      total_cost: total,
      currency: body.currency ?? 'UAH',
      note: body.note ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
