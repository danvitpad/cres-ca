/** --- YAML
 * name: User UI Preferences (sync web ↔ Mini App)
 * description: GET → читает profiles.ui_theme + ui_language + public_language.
 *              PATCH → обновляет любое из полей.
 *              Аутентификация: cookie session (веб) ИЛИ Telegram initData
 *              (Mini App, header X-TG-Init-Data). Без initData-fallback'a
 *              Mini App без cookie молча получал 401 и язык не сохранялся.
 * created: 2026-04-26
 * updated: 2026-05-18 (+ initData auth + admin client write)
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

const VALID_THEME = new Set(['auto', 'light', 'dark']);
const VALID_LANG = new Set(['ru', 'uk', 'en']);

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await admin()
    .from('profiles')
    .select('ui_theme, ui_language, public_language, haptic_enabled')
    .eq('id', userId)
    .maybeSingle();

  const profile = data as {
    ui_theme?: string;
    ui_language?: string;
    public_language?: string;
    haptic_enabled?: boolean;
  } | null;
  // Дефолт UI-языка для новых пользователей = 'uk' (правило 2026-05-06).
  // public_language наследуется от ui_language, иначе тоже 'uk'.
  return NextResponse.json({
    ui_theme: profile?.ui_theme ?? 'auto',
    ui_language: profile?.ui_language ?? 'uk',
    public_language: profile?.public_language ?? profile?.ui_language ?? 'uk',
    haptic_enabled: profile?.haptic_enabled ?? true,
  });
}

export async function PATCH(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    ui_theme?: string;
    ui_language?: string;
    public_language?: string;
    haptic_enabled?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const update: Record<string, string | boolean> = {};
  if (body.ui_theme && VALID_THEME.has(body.ui_theme)) update.ui_theme = body.ui_theme;
  if (body.ui_language && VALID_LANG.has(body.ui_language)) update.ui_language = body.ui_language;
  if (body.public_language && VALID_LANG.has(body.public_language)) update.public_language = body.public_language;
  if (typeof body.haptic_enabled === 'boolean') update.haptic_enabled = body.haptic_enabled;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 });
  }

  const adm = admin();
  // Если меняется ui_language и public_language ещё не выставлен пользователем
  // отдельно — синхронизируем его автоматически (поведение по умолчанию).
  if (update.ui_language && !update.public_language) {
    const { data: cur } = await adm
      .from('profiles')
      .select('public_language')
      .eq('id', userId)
      .maybeSingle();
    const currentPublic = (cur as { public_language?: string } | null)?.public_language ?? null;
    if (!currentPublic) {
      update.public_language = update.ui_language;
    }
  }

  const { error } = await adm.from('profiles').update(update).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...update });
}
