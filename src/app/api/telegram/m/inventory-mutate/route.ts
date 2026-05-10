/** --- YAML
 * name: Mini App — Inventory Item CRUD
 * description: Создание/обновление/удаление inventory_items для мастера. Auth через initData.
 *              Действия: create / update / delete. Поля: name, quantity, unit,
 *              low_stock_threshold (опц), cost_per_unit (опц), preferred_supplier_id (опц).
 *              Поля парити с web /[locale]/(dashboard)/inventory/page.tsx.
 * created: 2026-05-10
 * updated: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

interface MutateBody {
  action?: 'create' | 'update' | 'delete';
  id?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  low_stock_threshold?: number | null;
  cost_per_unit?: number | null;
  preferred_supplier_id?: string | null;
}

const ALLOWED_UNITS = new Set(['ml', 'g', 'pcs', 'bottles', 'impulses', 'sessions']);

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as MutateBody | null;
  if (!body?.action) return NextResponse.json({ error: 'missing_action' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  if (body.action === 'create') {
    const name = (body.name ?? '').trim();
    const unit = (body.unit ?? '').trim();
    const qty = Number(body.quantity);
    if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
    if (!unit || !ALLOWED_UNITS.has(unit)) return NextResponse.json({ error: 'bad_unit' }, { status: 400 });
    if (!Number.isFinite(qty) || qty < 0) return NextResponse.json({ error: 'bad_quantity' }, { status: 400 });
    const threshold = body.low_stock_threshold === null || body.low_stock_threshold === undefined
      ? null
      : Math.max(0, Number(body.low_stock_threshold));
    const cost = body.cost_per_unit === null || body.cost_per_unit === undefined
      ? 0
      : Math.max(0, Number(body.cost_per_unit));
    const { data, error } = await admin.from('inventory_items').insert({
      master_id: master.id,
      name,
      quantity: qty,
      unit,
      low_stock_threshold: threshold,
      cost_per_unit: cost,
      preferred_supplier_id: body.preferred_supplier_id ?? null,
    }).select('id').single<{ id: string }>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  if (body.action === 'update') {
    if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    // Verify ownership.
    const { data: row } = await admin
      .from('inventory_items')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!row || row.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string') {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
      patch.name = n;
    }
    if (typeof body.unit === 'string') {
      const u = body.unit.trim();
      if (!ALLOWED_UNITS.has(u)) return NextResponse.json({ error: 'bad_unit' }, { status: 400 });
      patch.unit = u;
    }
    if (body.quantity !== undefined) {
      const q = Number(body.quantity);
      if (!Number.isFinite(q) || q < 0) return NextResponse.json({ error: 'bad_quantity' }, { status: 400 });
      patch.quantity = q;
    }
    if (body.low_stock_threshold !== undefined) {
      patch.low_stock_threshold = body.low_stock_threshold === null
        ? null
        : Math.max(0, Number(body.low_stock_threshold));
    }
    if (body.cost_per_unit !== undefined) {
      patch.cost_per_unit = body.cost_per_unit === null
        ? 0
        : Math.max(0, Number(body.cost_per_unit));
    }
    if (body.preferred_supplier_id !== undefined) {
      patch.preferred_supplier_id = body.preferred_supplier_id ?? null;
    }
    const { error } = await admin.from('inventory_items').update(patch).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete') {
    if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const { data: row } = await admin
      .from('inventory_items')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!row || row.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const { error } = await admin.from('inventory_items').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
