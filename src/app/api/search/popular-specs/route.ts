/** --- YAML
 * name: Popular specializations API
 * description: Возвращает топ N специализаций для выбранной ниши (vertical) —
 *              из таблицы `vertical_specializations`, которая накапливает то,
 *              что мастера сами вводят в онбординге. Используется в клиентском
 *              поиске как подсказки-чипы под выбранной категорией («Маникюр /
 *              Брови / Стрижки»). Клик по чипу подставляет текст в строку поиска.
 *
 *              Public read — без авторизации (RLS на таблице это разрешает).
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { VerticalKey } from '@/lib/search/category-vertical';

const VALID: ReadonlySet<string> = new Set<VerticalKey>([
  'beauty', 'health', 'auto', 'tattoo', 'pets', 'craft', 'fitness', 'events', 'education', 'other',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vertical = url.searchParams.get('vertical') ?? '';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '12', 10) || 12, 1), 30);

  if (!VALID.has(vertical)) {
    return NextResponse.json({ specs: [] });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin.rpc('popular_specializations', {
    p_vertical: vertical,
    p_min_count: 1,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ specs: [] });
  }

  const specs = (data ?? [])
    .map((row: { text_display: string }) => row.text_display)
    .filter((s: string) => typeof s === 'string' && s.trim().length > 0);

  return NextResponse.json({ specs });
}
