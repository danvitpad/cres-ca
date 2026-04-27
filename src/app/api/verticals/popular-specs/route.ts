/** --- YAML
 * name: PopularSpecializationsApi
 * description: Возвращает специализации, которые ввели руками другие мастера/команды
 *              этой же ниши. Когда счётчик ≥ p_min_count (по умолчанию 2 — двое
 *              независимых мастеров написали одно и то же), вариант показывается
 *              как готовый чип следующим мастерам в онбординге.
 * created: 2026-04-27
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vertical = url.searchParams.get('vertical');
  if (!vertical) return NextResponse.json({ items: [] });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('popular_specializations', {
    p_vertical: vertical,
    p_min_count: 2,
    p_limit: 30,
  });

  if (error) {
    return NextResponse.json({ items: [] });
  }
  const items = (data ?? []).map((r: { text_display: string; count: number }) => ({
    text: r.text_display,
    count: r.count,
  }));
  return NextResponse.json({ items });
}
