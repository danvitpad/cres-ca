/** --- YAML
 * name: Telegram Master Service Mutate API
 * description: CRUD для услуг мастера из Mini App. POST {action} — create / update /
 *              archive (soft delete is_active=false) / restore. Validate ownership
 *              через master.profile_id == userId. Service-role + initData.
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

  if (body.action === 'create') {
    const name = (body.name ?? '').trim();
    const duration = Number(body.duration_minutes ?? 0);
    const price = Number(body.price ?? 0);
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    if (!Number.isFinite(duration) || duration <= 0) return NextResponse.json({ error: 'invalid_duration' }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'invalid_price' }, { status: 400 });

    const { data, error } = await admin
      .from('services')
      .insert({
        master_id: master.id,
        name,
        description: body.description?.trim() || null,
        duration_minutes: duration,
        price,
        currency: (body.currency ?? 'UAH').toUpperCase(),
        color: body.color ?? null,
        is_active: true,
      })
      .select('id')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'insert_failed', detail: error?.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (body.action === 'update') {
    if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    // Ownership check
    const { data: existing } = await admin
      .from('services')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!existing || existing.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const update: Record<string, string | number | null> = {};
    if (typeof body.name === 'string') {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: 'name_required' }, { status: 400 });
      update.name = n;
    }
    if ('description' in body) update.description = body.description?.toString().trim() || null;
    if (typeof body.duration_minutes === 'number') {
      if (body.duration_minutes <= 0) return NextResponse.json({ error: 'invalid_duration' }, { status: 400 });
      update.duration_minutes = body.duration_minutes;
    }
    if (typeof body.price === 'number') {
      if (body.price < 0) return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
      update.price = body.price;
    }
    if (typeof body.currency === 'string') update.currency = body.currency.toUpperCase();
    if ('color' in body) update.color = body.color ?? null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no_fields' }, { status: 400 });
    }

    const { error } = await admin.from('services').update(update).eq('id', body.id);
    if (error) {
      return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
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
