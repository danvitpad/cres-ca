/** --- YAML
 * name: resolveUserId
 * description: Универсальный резолвер ID пользователя для API.
 *              Cookie session → initData (header X-TG-Init-Data | query ?tg=).
 *              Возвращает userId или null. Banned profiles (platform_blacklist)
 *              никогда не резолвятся — API уровень тоже блокирует забаненных.
 * created: 2026-04-29
 * updated: 2026-05-05
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

async function isBanned(profileId: string): Promise<boolean> {
  const adm = admin();
  const { data } = await adm.rpc('is_profile_banned', { p_profile_id: profileId });
  return data === true;
}

export async function resolveUserId(req: Request): Promise<string | null> {
  // 1. Cookie session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (await isBanned(user.id)) return null;
    return user.id;
  }

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
  if (!profile?.id) return null;
  if (await isBanned(profile.id)) return null;
  return profile.id;
}
