/** --- YAML
 * name: resolveUserId
 * description: Универсальный резолвер ID пользователя для API.
 *              Cookie session → initData (header X-TG-Init-Data | query ?tg=).
 *              Возвращает userId или null.
 * created: 2026-04-29
 * --- */

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function resolveUserId(req: Request): Promise<string | null> {
  // 1. Cookie session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;

  // 2. Telegram initData — header preferred, query as fallback
  const url = new URL(req.url);
  const fromHeader = req.headers.get('x-tg-init-data');
  const fromQuery = url.searchParams.get('tg');
  let initData = fromHeader || fromQuery;

  // 3. Body — for POST requests with initData inside JSON
  if (!initData && req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const cloned = req.clone();
      const body = await cloned.json().catch(() => null) as { initData?: string } | null;
      if (body?.initData) initData = body.initData;
    } catch { /* ignore */ }
  }

  if (!initData) return null;

  const v = validateInitData(initData);
  if ('error' in v) return null;

  const adm = admin();
  const { data: profile } = await adm
    .from('profiles')
    .select('id')
    .eq('telegram_id', v.user.id)
    .maybeSingle();
  return profile?.id ?? null;
}
