/** --- YAML
 * name: Telegram Master Service Options API
 * description: Возвращает inventory (склад мастера) + при необходимости текущие
 *              service_materials (расходники привязанные к услуге). Использу-
 *              ется sheet'ом редактирования услуги в Mini App для секции
 *              «Расходники на один визит» — паритет с веб-формой.
 *              POST { service_id?: string }.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { service_id?: string };

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
  if (!master) {
    return NextResponse.json({ inventory: [], materials: [] });
  }

  const { data: inventory } = await admin
    .from('inventory_items')
    .select('id, name, unit, quantity')
    .eq('master_id', master.id)
    .order('name');

  let materials: Array<{ material_id: string; quantity: number; unit: string | null }> = [];
  if (body.service_id) {
    // Verify ownership
    const { data: svc } = await admin
      .from('services')
      .select('master_id')
      .eq('id', body.service_id)
      .maybeSingle<{ master_id: string }>();
    if (svc && svc.master_id === master.id) {
      const { data } = await admin
        .from('service_materials')
        .select('material_id, quantity, unit')
        .eq('service_id', body.service_id);
      materials = ((data ?? []) as Array<{ material_id: string; quantity: number | string; unit: string | null }>)
        .map((r) => ({ material_id: r.material_id, quantity: Number(r.quantity), unit: r.unit ?? null }));
    }
  }

  return NextResponse.json({
    inventory: inventory ?? [],
    materials,
  });
}
