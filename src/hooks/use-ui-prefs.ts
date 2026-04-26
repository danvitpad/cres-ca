/** --- YAML
 * name: useUiPrefs
 * description: Единая точка истины для (theme, ui_language) — синхронизация между
 *              web и Telegram Mini App. На mount подтягивает из БД, при изменении
 *              отправляет PATCH /api/me/ui-prefs. Дополнительно зеркалит в next-themes
 *              (через setTheme), и переустанавливает next-intl-cookie+location для языка.
 * created: 2026-04-26
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

export type UiTheme = 'auto' | 'light' | 'dark';
export type UiLanguage = 'ru' | 'uk' | 'en';

interface UiPrefs {
  theme: UiTheme;
  language: UiLanguage;
}

const VALID_LANGS: UiLanguage[] = ['ru', 'uk', 'en'];

function stripLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] && VALID_LANGS.includes(parts[0] as UiLanguage)) {
    return '/' + parts.slice(1).join('/');
  }
  return pathname;
}

export function useUiPrefs() {
  const { setTheme: setNextTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [prefs, setPrefs] = useState<UiPrefs>({ theme: 'auto', language: 'ru' });
  const [loaded, setLoaded] = useState(false);

  // Initial load — once per session
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/ui-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ui_theme?: UiTheme; ui_language?: UiLanguage } | null) => {
        if (cancelled || !data) { setLoaded(true); return; }
        const theme = (data.ui_theme ?? 'auto') as UiTheme;
        const language = (data.ui_language ?? 'ru') as UiLanguage;
        setPrefs({ theme, language });
        setNextTheme(theme === 'auto' ? 'system' : theme);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, [setNextTheme]);

  const updateTheme = useCallback(async (next: UiTheme) => {
    setPrefs((p) => ({ ...p, theme: next }));
    setNextTheme(next === 'auto' ? 'system' : next);
    try {
      await fetch('/api/me/ui-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_theme: next }),
      });
    } catch { /* offline-tolerant */ }
  }, [setNextTheme]);

  const updateLanguage = useCallback(async (next: UiLanguage) => {
    setPrefs((p) => ({ ...p, language: next }));
    try {
      await fetch('/api/me/ui-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_language: next }),
      });
    } catch { /* offline-tolerant */ }
    // Переключаем locale в URL без потери текущей страницы:
    // /ru/today  →  /uk/today (если префикс есть), иначе просто prefix-add.
    const stripped = stripLocale(pathname);
    const target = next === 'ru'
      ? stripped // localePrefix='as-needed' — RU без префикса
      : `/${next}${stripped === '/' ? '' : stripped}`;
    router.push(target);
    router.refresh();
  }, [pathname, router]);

  return { prefs, loaded, updateTheme, updateLanguage };
}
