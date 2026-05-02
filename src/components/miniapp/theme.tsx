/** --- YAML
 * name: MiniAppTheme
 * description: Тема Mini App следует ТОЛЬКО за Telegram.WebApp.colorScheme
 *              (или prefers-color-scheme когда открыто в браузере вне TG).
 *              Никаких ручных переключателей и DB-overrides — пользователь
 *              сам решает в настройках своего Telegram.
 *              Ставит data-theme=dark на корневой div, под который подвешены
 *              CSS-переменные с тёмной палитрой (см. globals.css). Все T.* токены
 *              в design.ts автоматически переключаются.
 * created: 2026-04-26
 * updated: 2026-05-02
 * --- */

'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

function readSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const w = window as { Telegram?: { WebApp?: { colorScheme?: string } } };
  const tgScheme = w.Telegram?.WebApp?.colorScheme;
  if (tgScheme === 'dark' || tgScheme === 'light') return tgScheme;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function MiniAppThemeProvider({ children, style, className }: Props) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(readSystemTheme());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(readSystemTheme());
    mql.addEventListener('change', onChange);
    type TG = { WebApp?: { onEvent?: (e: string, cb: () => void) => void; offEvent?: (e: string, cb: () => void) => void } };
    const tg = (window as { Telegram?: TG }).Telegram?.WebApp;
    tg?.onEvent?.('themeChanged', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      tg?.offEvent?.('themeChanged', onChange);
    };
  }, []);

  return (
    <div data-theme={theme} className={className} style={style}>
      {children}
    </div>
  );
}
