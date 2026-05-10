/** --- YAML
 * name: Popular Industry Subcategories API
 * description: Топ подкатегорий внутри категории — для чипов «Популярное»
 *              в поиске и в онбординге. Сортировка по master_count DESC.
 *              Параметры: ?categoryId=<uuid> — обязателен.
 *                         ?limit=12 — сколько вернуть.
 *                         ?minCount=1 — нижний порог (1 = всё что используется).
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get('categoryId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '12', 10), 50);
  const minCount = Math.max(parseInt(url.searchParams.get('minCount') ?? '1', 10), 0);

  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId_required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('popular_industry_subcategories', {
    p_category_id: categoryId,
    p_min_count: minCount,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
