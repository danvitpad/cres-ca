/** --- YAML
 * name: useMiniAppLocale
 * description: Shared locale hook for client Mini App pages. Reads from
 *              localStorage `cres:locale` (set by language picker). Returns
 *              current lang code. Pages define their own I18N dict and call
 *              `const t = I18N[lang]` — same pattern as home/page.tsx.
 * created: 2026-05-05
 * --- */

import { useEffect, useState } from 'react';

export type MiniAppLang = 'uk' | 'ru' | 'en';

const VALID: MiniAppLang[] = ['uk', 'ru', 'en'];

/**
 * Reads `cres:locale` from localStorage and returns the current Mini App language.
 * Defaults to 'uk' if not set or if the stored value is invalid.
 * Re-renders the component on mount (once localStorage is available).
 */
export function useMiniAppLocale(): MiniAppLang {
  const [lang, setLang] = useState<MiniAppLang>('uk');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as MiniAppLang | null;
      if (stored && VALID.includes(stored)) setLang(stored);
    } catch {
      // localStorage unavailable (SSR / private mode)
    }
  }, []);

  return lang;
}
