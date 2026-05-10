/** --- YAML
 * name: Master Categories API
 * description: GET — текущий выбор мастера (категории + подкатегории).
 *              PUT — атомарная перезапись выбора через RPC apply_master_categories.
 *              Принимает: { categoryIds: uuid[], primaryCategoryId: uuid, subcategoryIds: uuid[] }.
 *              Используется и в онбординге (после выбора), и в Settings → Профиль.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PutBody {
  categoryIds: string[];
  primaryCategoryId: string;
  subcategoryIds: string[];
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) return NextResponse.json({ categories: [], subcategories: [] });

  const { data, error } = await supabase.rpc('get_master_categories', { p_master_id: master.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { categories: [], subcategories: [] });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as PutBody | null;
  if (!body || !Array.isArray(body.categoryIds) || !body.primaryCategoryId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  if (body.categoryIds.length === 0) {
    return NextResponse.json({ error: 'at_least_one_category' }, { status: 400 });
  }

  if (!body.categoryIds.includes(body.primaryCategoryId)) {
    return NextResponse.json({ error: 'primary_must_be_in_categories' }, { status: 400 });
  }

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) return NextResponse.json({ error: 'profile_not_set_up' }, { status: 403 });

  const { error } = await supabase.rpc('apply_master_categories', {
    p_master_id: master.id,
    p_category_ids: body.categoryIds,
    p_primary_category_id: body.primaryCategoryId,
    p_subcategory_ids: Array.isArray(body.subcategoryIds) ? body.subcategoryIds : [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Бэк-совместимость: пишем legacy_vertical_key основной категории в masters.vertical
  // чтобы старый код (поиск, public-страницы) продолжал работать.
  const { data: primary } = await supabase
    .from('industry_categories')
    .select('legacy_vertical_key')
    .eq('id', body.primaryCategoryId)
    .maybeSingle();

  if (primary?.legacy_vertical_key) {
    await supabase
      .from('masters')
      .update({ vertical: primary.legacy_vertical_key })
      .eq('id', master.id);
    await supabase
      .from('profiles')
      .update({ vertical: primary.legacy_vertical_key })
      .eq('id', user.id);
  }

  return NextResponse.json({ ok: true });
}
