/** --- YAML
 * name: Telegram Master Service Mutate API
 * description: CRUD для услуг мастера из Mini App. POST {action} — create / update /
 *              archive / restore. Поля совпадают с веб-формой:
 *              name, description, duration_minutes, price, currency, color,
 *              is_mobile, travel_buffer_minutes, requires_prepayment,
 *              prepayment_amount. Service-role + initData валидация.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

type Body = {
  action: 'create' | 'update' | 'archive' | 'restore';
  id?: string;
  name?: string;
  description?: string | null;
  duration_minutes?: number;
  price?: number;
  currency?: string;
  color?: string | null;
  is_mobile?: boolean;
  travel_buffer_minutes?: number;
  requires_prepayment?: boolean;
  prepayment_amount?: number;
  /** Расходники привязанные к услуге. При передаче — полная замена
   *  service_materials (delete-then-insert), как в веб-форме. */
  materials?: Array<{ material_id: string; quantity: number }>;
};

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.action) {
    return NextResponse.json({ error: 'no_action' }, { status: 400 });
  }

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
    return NextResponse.json({ error: 'not_master' }, { status: 403 });
  }

  // Helper: собирает payload из body (только переданные поля).
  function buildPayload(): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    if (typeof body.name === 'string') p.name = body.name.trim();
    if ('description' in body) p.description = body.description?.toString().trim() || null;
    if (typeof body.duration_minutes === 'number') p.duration_minutes = body.duration_minutes;
    if (typeof body.price === 'number') p.price = body.price;
    if (typeof body.currency === 'string') p.currency = body.currency.toUpperCase();
    if ('color' in body) p.color = body.color ?? null;
    if (typeof body.is_mobile === 'boolean') p.is_mobile = body.is_mobile;
    if (typeof body.travel_buffer_minutes === 'number') p.travel_buffer_minutes = body.travel_buffer_minutes;
    if (typeof body.requires_prepayment === 'boolean') p.requires_prepayment = body.requires_prepayment;
    if (typeof body.prepayment_amount === 'number') p.prepayment_amount = body.prepayment_amount;
    return p;
  }

  // Helper: синхронизирует service_materials = полная замена. Возвращает error
  // строку если что-то пошло не так. Materials с qty<=0 пропускаются (deletion).
  async function syncMaterials(serviceId: string): Promise<string | null> {
    if (!Array.isArray(body.materials)) return null;
    const { error: delErr } = await admin.from('service_materials').delete().eq('service_id', serviceId);
    if (delErr) return delErr.message;
    const rows = body.materials
      .filter((m) => m && m.material_id && Number(m.quantity) > 0)
      .map((m) => ({
        service_id: serviceId,
        material_id: m.material_id,
        quantity: Number(m.quantity),
      }));
    if (rows.length === 0) return null;
    const { error: insErr } = await admin.from('service_materials').insert(rows);
    return insErr?.message ?? null;
  }

  if (body.action === 'create') {
    const name = (body.name ?? '').trim();
    const duration = Number(body.duration_minutes ?? 0);
    const price = Number(body.price ?? 0);
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    if (!Number.isFinite(duration) || duration <= 0) return NextResponse.json({ error: 'invalid_duration' }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'invalid_price' }, { status: 400 });

    const payload = {
      master_id: master.id,
      is_active: true,
      ...buildPayload(),
    };
    const { data, error } = await admin.from('services').insert(payload).select('id').single();
    if (error || !data) {
      return NextResponse.json({ error: 'insert_failed', detail: error?.message }, { status: 500 });
    }
    const matErr = await syncMaterials(data.id);
    if (matErr) {
      return NextResponse.json({ error: 'materials_failed', detail: matErr }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (body.action === 'update') {
    if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const { data: existing } = await admin
      .from('services')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!existing || existing.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const update = buildPayload();
    if (typeof body.name === 'string' && !(update.name as string)) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }
    if (Object.keys(update).length > 0) {
      const { error } = await admin.from('services').update(update).eq('id', body.id);
      if (error) {
        return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
      }
    }
    const matErr = await syncMaterials(body.id);
    if (matErr) {
      return NextResponse.json({ error: 'materials_failed', detail: matErr }, { status: 500 });
    }
    if (Object.keys(update).length === 0 && !Array.isArray(body.materials)) {
      return NextResponse.json({ error: 'no_fields' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'archive' || body.action === 'restore') {
    if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const { data: existing } = await admin
      .from('services')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!existing || existing.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const { error } = await admin
      .from('services')
      .update({ is_active: body.action === 'restore' })
      .eq('id', body.id);
    if (error) {
      return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
