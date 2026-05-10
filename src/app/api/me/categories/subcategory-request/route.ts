/** --- YAML
 * name: Request Industry Subcategory
 * description: Мастер ввёл свой текст вместо выбора готовой подкатегории.
 *              Если такая подкатегория уже есть в этой категории (case-insensitive
 *              по name_ru) — просто привязываем мастера. Иначе создаём pending —
 *              после 3+ мастеров она автоапрувится в active. RPC внутри.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Body {
  categoryId: string;
  text: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.categoryId || !body.text || body.text.trim().length < 2) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('request_industry_subcategory', {
    p_category_id: body.categoryId,
    p_text: body.text,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Возвращаем созданную/найденную подкатегорию
  const { data: sub } = await supabase
    .from('industry_subcategories')
    .select('id, category_id, key, name_ru, name_uk, name_en, status')
    .eq('id', data as string)
    .maybeSingle();

  return NextResponse.json({ subcategory: sub });
}
