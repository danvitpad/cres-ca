/** --- YAML
 * name: useSyncLocaleFromDb
 * description: Тянет profiles.ui_language + ui_theme из БД когда userId
 *              появляется в auth store. БД — источник правды: что выбрано
 *              в Настройках, то и применяется при каждом входе.
 *              Раньше эффект имел пустые deps и срабатывал на mount раньше,
 *              чем cookie auth поднимался — fetch получал 401 и хук молча
 *              сдыхал. Теперь зависит от userId и повторяется когда юзер
 *              реально появился.
 * created: 2026-05-09
 * updated: 2026-05-18 (+ DB > Telegram theme priority + userId dependency)
 * --- */

'use client';

import { useEffect } from 'react';
import { setMiniAppLocale, type MiniAppLang } from './use-locale';
import { useAuthStore } from '@/stores/auth-store';

const VALID: MiniAppLang[] = ['uk', 'ru', 'en'];
const VALID_THEME = new Set(['auto', 'light', 'dark']);

interface UiPrefs {
  ui_language?: string;
  ui_theme?: string;
}

export function useSyncLocaleFromDb(): void {
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    // Без auth fetch вернёт 401 — даже не пробуем.
    if (!userId) return;
    let cancelled = false;
    fetch('/api/me/ui-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UiPrefs | null) => {
        if (cancelled || !data) return;

        // Язык: применяем если в БД лежит валидное значение и оно отличается
        // от текущего локального. setMiniAppLocale сам ничего не делает если
        // совпадает по факту, но эта проверка экономит лишний event/PATCH.
        const dbLang = data.ui_language as MiniAppLang | undefined;
        if (dbLang && VALID.includes(dbLang)) {
          let localLang: string | null = null;
          try { localLang = localStorage.getItem('cres:locale'); } catch { /* ignore */ }
          if (localLang !== dbLang) setMiniAppLocale(dbLang);
        }

        // Тема: записываем в localStorage override. ThemeProvider читает
        // его как 'cres:theme-override' и применяет с приоритетом выше
        // Telegram.colorScheme. 'auto' = удаляем override (= следуем системе).
        const dbTheme = data.ui_theme;
        if (dbTheme && VALID_THEME.has(dbTheme)) {
          try {
            if (dbTheme === 'auto') {
              localStorage.removeItem('cres:theme-override');
            } else {
              localStorage.setItem('cres:theme-override', dbTheme);
            }
            window.dispatchEvent(new CustomEvent('cres:theme-override-changed'));
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* offline — оставляем localStorage значение */ });
    return () => { cancelled = true; };
  }, [userId]);
}
