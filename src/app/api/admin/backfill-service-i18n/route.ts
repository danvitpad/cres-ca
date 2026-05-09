/** --- YAML
 * name: Backfill services.name_i18n via AI
 * description: One-shot endpoint — переводит все services с null name_i18n
 *   на 3 языка (uk/ru/en) через Gemini fallback OpenRouter. Защищён
 *   CRON_SECRET для безопасности (можно дёрнуть curl'ом). Обрабатывает
 *   до limit услуг за раз чтобы не упереться в Gemini RPM.
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { translateService } from '@/lib/i18n/translate-service';

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: rows } = await admin
    .from('services')
    .select('id, name, description')
    .is('name_i18n', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const list = (rows ?? []) as Array<{ id: string; name: string; description: string | null }>;
  if (list.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'nothing to backfill' });
  }

  let processed = 0;
  let failed = 0;

  // Sequential to не упереться в Gemini RPM — лимит у бесплатного очень низкий.
  for (const svc of list) {
    if (!svc.name) continue;
    try {
      const result = await translateService(svc.name, svc.description);
      if (!result) {
        failed++;
        continue;
      }
      const update: Record<string, unknown> = { name_i18n: result.name };
      if (result.description) update.description_i18n = result.description;
      await admin.from('services').update(update).eq('id', svc.id);
      processed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed, failed, total: list.length });
}
