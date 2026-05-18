/** --- YAML
 * name: MiniAppTheme
 * description: Тема Mini App. Приоритеты:
 *              (1) localStorage 'cres:theme-override' (= ui_theme из БД, синкается
 *                  через useSyncLocaleFromDb после auth, и через ручной toggle),
 *              (2) Telegram.WebApp.colorScheme (когда override = 'auto'/null),
 *              (3) prefers-color-scheme.
 *              Ставит data-theme=dark на корневой div — CSS var(--m-*) переключаются автоматически.
 *              Экспортирует useMiniAppTheme() для чтения/записи override из настроек.
 *              setOverride пишет одновременно в localStorage и в БД через
 *              PATCH /api/me/ui-prefs — между устройствами синхронизируется
 *              автоматически.
 * created: 2026-04-26
 * updated: 2026-05-18 (+ DB persistence)
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
    // useSyncLocaleFromDb пишет ui_theme в localStorage после auth — мы
    // слушаем custom-event и подхватываем сразу, без перезагрузки.
    const onOverrideChanged = () => setOverrideState(readStoredOverride());
    window.addEventListener('cres:theme-override-changed', onOverrideChanged);
    return () => {
      mql.removeEventListener('change', onChange);
      tg?.offEvent?.('themeChanged', onChange);
      window.removeEventListener('cres:theme-override-changed', onOverrideChanged);
    };
  }, []);

  const setOverride = useCallback((t: Theme | null) => {
    try {
      if (t) localStorage.setItem(STORAGE_KEY, t);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setOverrideState(t);
    // Persist в БД — null override = 'auto' (следовать Telegram).
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
      body: JSON.stringify({ ui_theme: t ?? 'auto' }),
    }).catch(() => { /* offline-tolerant */ });
  }, []);

  const theme = override ?? systemTheme;

  // Telegram chrome (header / background / bottom bar) ВСЕГДА красим
  // нашим hex'ом по текущей теме (override или systemTheme). Раньше при
  // отсутствии override отдавалось keyword 'bg_color' — TG показывал
  // системную полоску (белую/чёрную в зависимости от темы Telegram),
  // которая отличалась от нашего фона. По запросу 2026-05-08 — везде
  // цвет нашего сервиса, никаких системных полосок.
  //
  // Параллельно красим html+body тем же hex'ом — иначе при системной
  // dark-теме iOS body остаётся shadcn-белым, и по краям floating
  // bottom-nav / при сворачивании Mini App / overscroll bounce видны
  // белые полоски и углы (правило 11 в CLAUDE.md). Раньше эту покраску
  // делал отдельный useEffect в layout.tsx через
  // getComputedStyle(root).getPropertyValue('--m-bg'), но переменная
  // живёт на data-theme div'е (ребёнке body) и наверх не наследуется —
  // fallback всегда #ffffff, dark-тема белела по краям.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    type TG = { WebApp?: {
      setHeaderColor?: (c: string) => void;
      setBackgroundColor?: (c: string) => void;
      setBottomBarColor?: (c: string) => void;
    }};
    const w = window as { Telegram?: TG };
    const wa = w.Telegram?.WebApp;

    // Hex ТОЧНО совпадает с --m-bg (см. globals.css). Раньше стоял
    // #0f0f0f в dark, а реальный --m-bg = #141417 — из-за этого шапка
    // казалась темнее body.
    const hex = theme === 'dark' ? '#141417' : '#ffffff';

    if (wa) {
      try { wa.setHeaderColor?.(hex); } catch {}
      try { wa.setBackgroundColor?.(hex); } catch {}
      try { wa.setBottomBarColor?.(hex); } catch {}
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = hex;
    body.style.backgroundColor = hex;
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, override, setOverride }}>
      <div data-theme={theme} className={className} style={style}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
