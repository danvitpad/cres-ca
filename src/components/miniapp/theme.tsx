/** --- YAML
 * name: MiniAppTheme
 * description: Тема Mini App. Приоритеты: (1) localStorage 'cres:theme-override' (ручной
 *              переключатель в настройках), (2) Telegram.WebApp.colorScheme, (3) prefers-color-scheme.
 *              Ставит data-theme=dark на корневой div — CSS var(--m-*) переключаются автоматически.
 *              Экспортирует useMiniAppTheme() для чтения/записи override из настроек.
 * created: 2026-04-26
 * updated: 2026-05-07
 * --- */

'use client';

import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'cres:theme-override';

function readStoredOverride(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* ignore */ }
  return null;
}

function readSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const w = window as { Telegram?: { WebApp?: { colorScheme?: string } } };
  const tgScheme = w.Telegram?.WebApp?.colorScheme;
  if (tgScheme === 'dark' || tgScheme === 'light') return tgScheme;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

interface ThemeCtx {
  theme: Theme;
  override: Theme | null;
  setOverride: (t: Theme | null) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', override: null, setOverride: () => {} });

export function useMiniAppTheme() {
  return useContext(ThemeContext);
}

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function MiniAppThemeProvider({ children, style, className }: Props) {
  const [override, setOverrideState] = useState<Theme | null>(null);
  const [systemTheme, setSystemTheme] = useState<Theme>('light');

  useEffect(() => {
    setOverrideState(readStoredOverride());
    setSystemTheme(readSystemTheme());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(readSystemTheme());
    mql.addEventListener('change', onChange);
    type TG = { WebApp?: { onEvent?: (e: string, cb: () => void) => void; offEvent?: (e: string, cb: () => void) => void } };
    const tg = (window as { Telegram?: TG }).Telegram?.WebApp;
    tg?.onEvent?.('themeChanged', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      tg?.offEvent?.('themeChanged', onChange);
    };
  }, []);

  const setOverride = useCallback((t: Theme | null) => {
    try {
      if (t) localStorage.setItem(STORAGE_KEY, t);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setOverrideState(t);
  }, []);

  const theme = override ?? systemTheme;

  // Когда override активен — Telegram chrome (header/background/bottom bar) надо
  // принудительно красить нашим hex'ом, иначе он остаётся в системной теме TG
  // и шапка остаётся белой при ручном переключении на тёмную.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    type TG = { WebApp?: {
      setHeaderColor?: (c: string) => void;
      setBackgroundColor?: (c: string) => void;
      setBottomBarColor?: (c: string) => void;
    }};
    const w = window as { Telegram?: TG };
    const wa = w.Telegram?.WebApp;
    if (!wa) return;

    if (override) {
      // Hex-цвета, идентичные --m-bg / --m-surface для светлой и тёмной темы
      const hex = override === 'dark' ? '#0f0f0f' : '#ffffff';
      try { wa.setHeaderColor?.(hex); } catch {}
      try { wa.setBackgroundColor?.(hex); } catch {}
      try { wa.setBottomBarColor?.(hex); } catch {}
    } else {
      // Override снят — отдаём управление Telegram через keyword
      try { wa.setHeaderColor?.('bg_color'); } catch {}
      try { wa.setBackgroundColor?.('bg_color'); } catch {}
      try { wa.setBottomBarColor?.('bg_color'); } catch {}
    }
  }, [override]);

  return (
    <ThemeContext.Provider value={{ theme, override, setOverride }}>
      <div data-theme={theme} className={className} style={style}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
