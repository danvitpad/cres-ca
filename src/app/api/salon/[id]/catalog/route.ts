/** --- YAML
 * name: Salon Catalog API (unified mode)
 * description:
 *   GET    /api/salon/[id]/catalog — список услуг каталога салона.
 *   POST   /api/salon/[id]/catalog — создать новую услугу
 *          { name, duration_minutes?, price?, currency?, description?, category_id? }
 *   Только admin/owner салона. Используется когда team_mode='unified'.
 * created: 2026-04-27
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('salon_services')
    .select('id, name, description, duration_minutes, price, currency, category_id, is_active, sort_order, category:service_categories(id, name)')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string;
        description?: string;
        duration_minutes?: number;
        price?: number;
        currency?: string;
        category_id?: string;
      }
    | null;
  if (!body?.name || !body.name.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('salon_services')
    .insert({
      salon_id: salonId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      duration_minutes: body.duration_minutes ?? null,
      price: body.price ?? null,
      currency: (body.currency || 'UAH').toUpperCase(),
      category_id: body.category_id ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ service_id: (data as { id: string }).id });
}
