/** --- YAML
 * name: Industry Categories Catalog API
 * description: GET список всех активных категорий с подкатегориями.
 *              Используется в онбординге, в настройках профиля мастера и
 *              в фильтре поиска. Отдаёт три локали name_ru/uk/en —
 *              UI выбирает по текущему locale.
 *              ?include=subs → включить подкатегории
 *              ?order=popular → сортировка по числу мастеров (default — sort_order)
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeSubs = url.searchParams.get('include') === 'subs';
  const orderPopular = url.searchParams.get('order') === 'popular';

  const supabase = await createClient();

  const { data: cats, error } = await supabase
    .from('industry_categories')
    .select('id, key, name_ru, name_uk, name_en, icon, master_count, sort_order')
    .eq('status', 'active')
    .order(orderPopular ? 'master_count' : 'sort_order', { ascending: !orderPopular });

  if (error || !cats) {
    return NextResponse.json({ error: error?.message ?? 'failed' }, { status: 500 });
  }

  if (!includeSubs) {
    return NextResponse.json({ categories: cats });
  }

  const { data: subs } = await supabase
    .from('industry_subcategories')
    .select('id, category_id, key, name_ru, name_uk, name_en, master_count, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  const subsByCat = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    const list = subsByCat.get(s.category_id) ?? [];
    list.push(s);
    subsByCat.set(s.category_id, list);
  }

  const enriched = cats.map((c) => ({
    ...c,
    subcategories: subsByCat.get(c.id) ?? [],
  }));

  return NextResponse.json({ categories: enriched });
}
