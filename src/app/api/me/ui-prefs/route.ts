/** --- YAML
 * name: User UI Preferences (sync web ↔ Mini App)
 * description: GET → читает profiles.ui_theme + ui_language. PATCH → обновляет
 *              одно или оба поля. Используется и web (next-themes / next-intl),
 *              и Mini App (master telegram client + client telegram client) —
 *              чтобы тема и язык интерфейса жили в одном месте, а не в
 *              localStorage и cookie независимо.
 * created: 2026-04-26
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
    .select('ui_theme, ui_language')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    ui_theme: (data?.ui_theme as string | undefined) ?? 'auto',
    ui_language: (data?.ui_language as string | undefined) ?? 'ru',
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { ui_theme?: string; ui_language?: string } | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const update: Record<string, string> = {};
  if (body.ui_theme && VALID_THEME.has(body.ui_theme)) update.ui_theme = body.ui_theme;
  if (body.ui_language && VALID_LANG.has(body.ui_language)) update.ui_language = body.ui_language;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...update });
}
