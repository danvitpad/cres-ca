/** --- YAML
 * name: Mini App — Supplier CRUD
 * description: Создание/обновление/удаление suppliers для мастера. Auth через initData.
 *              Действия: create / update / delete. Поля: name, contact_person, phone, email,
 *              telegram_id, note, is_active.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

interface MutateBody {
  action?: 'create' | 'update' | 'delete';
  id?: string;
  name?: string;
  entity_type?: 'individual' | 'company';
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  telegram_id?: string | null;
  note?: string | null;
  is_active?: boolean;
}

function clean(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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
    const name = clean(body.name);
    if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
    const { data, error } = await admin.from('suppliers').insert({
      master_id: master.id,
      name,
      entity_type: body.entity_type === 'company' ? 'company' : 'individual',
      contact_person: clean(body.contact_person),
      phone: clean(body.phone),
      email: clean(body.email),
      telegram_id: clean(body.telegram_id),
      note: clean(body.note),
      is_active: true,
    }).select('id').single<{ id: string }>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  if (body.action === 'update') {
    if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const { data: row } = await admin
      .from('suppliers')
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
    if (body.entity_type === 'individual' || body.entity_type === 'company') patch.entity_type = body.entity_type;
    if (body.contact_person !== undefined) patch.contact_person = clean(body.contact_person);
    if (body.phone !== undefined) patch.phone = clean(body.phone);
    if (body.email !== undefined) patch.email = clean(body.email);
    if (body.telegram_id !== undefined) patch.telegram_id = clean(body.telegram_id);
    if (body.note !== undefined) patch.note = clean(body.note);
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    const { error } = await admin.from('suppliers').update(patch).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete') {
    if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    const { data: row } = await admin
      .from('suppliers')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!row || row.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // Soft-delete через is_active=false — реальный DELETE может оставить orphans
    // в supplier_orders. Архив = is_active=false.
    const { error } = await admin.from('suppliers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
