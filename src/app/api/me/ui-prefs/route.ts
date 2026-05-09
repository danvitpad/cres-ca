/** --- YAML
 * name: User UI Preferences (sync web ↔ Mini App)
 * description: GET → читает profiles.ui_theme + ui_language + public_language.
 *              PATCH → обновляет любое из полей.
 *              ui_language — язык интерфейса и личных уведомлений (письма
 *              себе, TG-уведомления, сброс пароля и т.п.).
 *              public_language — язык исходящих коммуникаций мастера/команды
 *              (рассылки клиентам, заказы поставщикам). По умолчанию = ui_language.
 *              При смене ui_language через language-switcher поле сохраняется
 *              в БД и становится постоянным выбором пользователя.
 * created: 2026-04-26
 * updated: 2026-04-30 (+ public_language)
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_THEME = new Set(['auto', 'light', 'dark']);
const VALID_LANG = new Set(['ru', 'uk', 'en']);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('profiles')
    .select('ui_theme, ui_language, public_language, haptic_enabled')
    .eq('id', user.id)
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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

  // Если меняется ui_language и public_language ещё не выставлен пользователем
  // отдельно — синхронизируем его автоматически (поведение по умолчанию).
  if (update.ui_language && !update.public_language) {
    const { data: cur } = await supabase
      .from('profiles')
      .select('public_language')
      .eq('id', user.id)
      .maybeSingle();
    const currentPublic = (cur as { public_language?: string } | null)?.public_language ?? null;
    if (!currentPublic) {
      update.public_language = update.ui_language;
    }
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...update });
}
