/** --- YAML
 * name: TelegramMasterServiceCategoryMutate
 * description: CRUD для категорий услуг мастера из Mini App.
 *              POST {action: 'create'|'rename'|'delete', name?, id?}.
 *              При delete категория удаляется, услуги остаются с
 *              category_id=NULL (FK ON DELETE SET NULL — fallback в
 *              «Без категории»).
 * created: 2026-05-12
 * --- */

import { NextResponse } from 'next/server';
import { resolveUserId } from '@/lib/auth/resolve-user';
import { createClient as createAdminClient } from '@supabase/supabase-js';

type Body = {
  action: 'create' | 'rename' | 'delete';
  id?: string;
  name?: string;
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
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'no_name' }, { status: 400 });
    }
    const { data, error } = await admin
      .from('service_categories')
      .insert({ master_id: master.id, name, sort_order: 999 })
      .select('id, name, sort_order')
      .single();
    if (error) {
      return NextResponse.json({ error: 'create_failed', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, category: data });
  }

  if (body.action === 'rename') {
    if (!body.id || !body.name?.trim()) {
      return NextResponse.json({ error: 'no_id_or_name' }, { status: 400 });
    }
    // Защита: rename только своей категории.
    const { data: existing } = await admin
      .from('service_categories')
      .select('id')
      .eq('id', body.id)
      .eq('master_id', master.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const { error } = await admin
      .from('service_categories')
      .update({ name: body.name.trim() })
      .eq('id', body.id);
    if (error) {
      return NextResponse.json({ error: 'rename_failed', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete') {
    if (!body.id) {
      return NextResponse.json({ error: 'no_id' }, { status: 400 });
    }
    const { data: existing } = await admin
      .from('service_categories')
      .select('id')
      .eq('id', body.id)
      .eq('master_id', master.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    // Услуги в этой категории — переключаем category_id=NULL (Без категории).
    await admin.from('services').update({ category_id: null }).eq('category_id', body.id);
    const { error } = await admin.from('service_categories').delete().eq('id', body.id);
    if (error) {
      return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
