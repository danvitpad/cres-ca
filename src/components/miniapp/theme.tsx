/** --- YAML
 * name: MiniAppTheme
 * description: Единая тема (light/dark) для всех Mini App ролей. Резолвит:
 *              1) profile.ui_theme (если задано пользователем явно)
 *              2) Telegram.WebApp.colorScheme (когда внутри TG)
 *              3) prefers-color-scheme (когда вне TG, например DAKI Chrome)
 *              Светит data-theme=dark на корневой div, под который подвешены
 *              CSS-переменные с тёмной палитрой (см. globals.css). Все T.* токены
 *              в design.ts автоматически переключаются.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

type Theme = 'light' | 'dark';

async function readProfileTheme(userId: string | null): Promise<Theme | null> {
  if (!userId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('ui_theme')
    .eq('id', userId)
    .maybeSingle();
  const v = (data as { ui_theme: string | null } | null)?.ui_theme;
  return v === 'dark' ? 'dark' : v === 'light' ? 'light' : null;
}

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
}

export function MiniAppThemeProvider({ children, style }: Props) {
  const userId = useAuthStore((s) => s.userId);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const explicit = await readProfileTheme(userId);
      if (cancelled) return;
      setTheme(explicit ?? readSystemTheme());
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      readProfileTheme(userId).then((explicit) => {
        if (!explicit) setTheme(readSystemTheme());
      });
    };
    mql.addEventListener('change', onChange);
    type TG = { WebApp?: { onEvent?: (e: string, cb: () => void) => void; offEvent?: (e: string, cb: () => void) => void } };
    const tg = (window as { Telegram?: TG }).Telegram?.WebApp;
    tg?.onEvent?.('themeChanged', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      tg?.offEvent?.('themeChanged', onChange);
    };
  }, [userId]);

  return (
    <div data-theme={theme} style={style}>
      {children}
    </div>
  );
}
