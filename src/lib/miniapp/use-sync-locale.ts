/** --- YAML
 * name: useSyncLocaleFromDb
 * description: При mount Mini App layout'а тянет profiles.ui_language из БД
 *              и применяет через setMiniAppLocale, если оно отличается от
 *              текущего localStorage значения. Это даёт persistence между
 *              сессиями и устройствами — после повторного открытия Mini App
 *              язык остаётся тот, который пользователь выбирал.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect } from 'react';
import { setMiniAppLocale, type MiniAppLang } from './use-locale';

const VALID: MiniAppLang[] = ['uk', 'ru', 'en'];

export function useSyncLocaleFromDb(): void {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/ui-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ui_language?: string } | null) => {
        if (cancelled) return;
        const dbLang = data?.ui_language as MiniAppLang | undefined;
        if (!dbLang || !VALID.includes(dbLang)) return;

        // Если localStorage уже = БД, ничего не делаем (избегаем лишних
        // событий перерендера).
        let localLang: string | null = null;
        try {
          localLang = localStorage.getItem('cres:locale');
        } catch {
          // ignore
        }
        if (localLang === dbLang) return;

        setMiniAppLocale(dbLang);
      })
      .catch(() => { /* offline — оставляем localStorage значение */ });
    return () => { cancelled = true; };
  }, []);
}
