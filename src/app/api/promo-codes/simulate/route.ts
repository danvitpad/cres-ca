/** --- YAML
 * name: Promo Code Simulator
 * description: Шаг 10 — мастер видит превью «что станет с финансами» ПЕРЕД сохранением
 *              промокода. Берёт {discount_type, discount_value, applicable_service_ids[]},
 *              для каждой подходящей услуги считает финальную цену + себестоимость
 *              расходников и помечает is_safe=false если в минус.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface Body {
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  applicable_service_ids?: string[];
}

interface SimRow {
  service_id: string;
  service_name: string;
  original_price: number;
  discount_amount: number;
  final_price: number;
  material_cost: number;
  margin_per_visit: number;
  is_safe: boolean;
  warning: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.discount_value !== 'number' || !body.discount_type) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (body.discount_type !== 'percentage' && body.discount_type !== 'fixed') {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }

  // Auth: master must be the owner
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin.rpc('simulate_promo_impact', {
    p_master_id: master.id,
    p_discount_type: body.discount_type,
    p_discount_value: body.discount_value,
    p_applicable_service_ids: body.applicable_service_ids ?? [],
  });

  if (error) {
    return NextResponse.json({ error: 'rpc_failed', detail: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SimRow[];
  const totalUnsafe = rows.filter((r) => !r.is_safe).length;
  const totalSafe = rows.length - totalUnsafe;
  const minMargin = rows.length === 0 ? 0 : Math.min(...rows.map((r) => Number(r.margin_per_visit)));
  const avgMargin = rows.length === 0 ? 0 : rows.reduce((sum, r) => sum + Number(r.margin_per_visit), 0) / rows.length;

  return NextResponse.json({
    ok: true,
    rows,
    summary: {
      total_services: rows.length,
      safe_services: totalSafe,
      unsafe_services: totalUnsafe,
      min_margin_per_visit: Math.round(minMargin),
      avg_margin_per_visit: Math.round(avgMargin),
      // Прогноз при 100 клиентах применивших промокод:
      revenue_per_100: Math.round(rows.reduce((sum, r) => sum + Number(r.final_price), 0) / Math.max(1, rows.length) * 100),
      profit_per_100: Math.round(avgMargin * 100),
    },
  });
}
