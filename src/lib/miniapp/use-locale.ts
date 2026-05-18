/** --- YAML
 * name: useMiniAppLocale
 * description: Shared locale hook for Mini App pages. Reads from
 *              localStorage `cres:locale` (set by language picker). Returns
 *              current lang code AND reacts live to changes via the
 *              `cres:locale-changed` custom event — no page reload needed.
 *              Pages define their own I18N dict and call `const t = I18N[lang]`.
 * created: 2026-05-05
 * updated: 2026-05-09
 * --- */

import { useEffect, useState } from 'react';

export type MiniAppLang = 'uk' | 'ru' | 'en';

const VALID: MiniAppLang[] = ['uk', 'ru', 'en'];
export const LOCALE_CHANGED_EVENT = 'cres:locale-changed';

function read(): MiniAppLang {
  try {
    const stored = localStorage.getItem('cres:locale') as MiniAppLang | null;
    if (stored && VALID.includes(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return 'uk';
}

export function useMiniAppLocale(): MiniAppLang {
  const [lang, setLang] = useState<MiniAppLang>('uk');

  useEffect(() => {
    setLang(read());

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<MiniAppLang>).detail;
      if (detail && VALID.includes(detail)) {
        setLang(detail);
      } else {
        setLang(read());
      }
    };
    window.addEventListener(LOCALE_CHANGED_EVENT, onChange);
    // storage event срабатывает в других вкладках, но для safety
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(LOCALE_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return lang;
}

/** Persist + broadcast new locale. Все компоненты через useMiniAppLocale
 *  моментально перерисуются, без перезагрузки страницы.
 *  Также сохраняем в БД (profiles.ui_language) fire-and-forget — чтобы при
 *  следующем заходе useSyncLocaleFromDb подтянул сохранённый язык, а не
 *  сбрасывал на дефолт. */
export function setMiniAppLocale(code: MiniAppLang): void {
  if (!VALID.includes(code)) return;
  try {
    localStorage.setItem('cres:locale', code);
  } catch {
    // ignore
  }
  // cookie тоже обновляем — нужно для веб-кабинета и SSR.
  document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;

  window.dispatchEvent(new CustomEvent<MiniAppLang>(LOCALE_CHANGED_EVENT, { detail: code }));

  // Persist в БД — без await, ошибки игнорируем (offline).
  // X-TG-Init-Data нужен потому что в Mini App контексте часто нет
  // Supabase cookie session; endpoint поддерживает оба способа auth.
  const initData: string = (() => {
    try {
      const w = window as { Telegram?: { WebApp?: { initData?: string } } };
      return w.Telegram?.WebApp?.initData ?? '';
    } catch { return ''; }
  })();
  fetch('/api/me/ui-prefs', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-TG-Init-Data': initData } : {}),
    },
    body: JSON.stringify({ ui_language: code }),
  }).catch(() => { /* tolerant */ });
}
