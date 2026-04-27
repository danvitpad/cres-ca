/** --- YAML
 * name: Salon Catalog Service — patch + delete
 * description:
 *   PATCH  /api/salon/[id]/catalog/[serviceId] — обновить поля услуги
 *   DELETE /api/salon/[id]/catalog/[serviceId] — мягкое удаление (is_active=false)
 *   Только admin/owner салона.
 * created: 2026-04-27
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

interface RouteContext {
  params: Promise<{ id: string; serviceId: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id: salonId, serviceId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Partial<{
    name: string;
    description: string;
    duration_minutes: number;
    price: number;
    currency: string;
    category_id: string | null;
    is_active: boolean;
    sort_order: number;
  }> | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.duration_minutes !== undefined) update.duration_minutes = body.duration_minutes;
  if (body.price !== undefined) update.price = body.price;
  if (body.currency !== undefined) update.currency = body.currency.toUpperCase();
  if (body.category_id !== undefined) update.category_id = body.category_id;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.sort_order !== undefined) update.sort_order = body.sort_order;

  const supabase = await createClient();
  const { error } = await supabase
    .from('salon_services')
    .update(update)
    .eq('id', serviceId)
    .eq('salon_id', salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id: salonId, serviceId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { error } = await supabase
    .from('salon_services')
    .update({ is_active: false })
    .eq('id', serviceId)
    .eq('salon_id', salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
