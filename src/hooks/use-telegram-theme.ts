/** --- YAML
 * name: useTelegramTheme
 * description: Hook that syncs Telegram theme params to CSS variables and dark/light mode
 * --- */

'use client';

import { useEffect } from 'react';
import { tg, isTelegram } from '@/lib/telegram/webapp';

const themeMap: Record<string, string> = {
  bg_color: '--surface-primary',
  text_color: '--foreground',
  hint_color: '--muted-foreground',
  link_color: '--ds-accent',
  button_color: '--ds-accent',
  button_text_color: '--ds-accent-foreground',
  secondary_bg_color: '--surface-secondary',
  section_bg_color: '--surface-elevated',
};

function applyTheme() {
  const webapp = tg();
  if (!webapp) return;

  const root = document.documentElement;

  // Dark/light mode
  if (webapp.colorScheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Map Telegram theme params to CSS variables
  const params = webapp.themeParams;
  for (const [tgKey, cssVar] of Object.entries(themeMap)) {
    const value = params[tgKey as keyof typeof params];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }
}

export function useTelegramTheme() {
  useEffect(() => {
    if (!isTelegram()) return;

    applyTheme();

    // Listen for theme changes
    const webapp = tg();
    if (!webapp) return;

    const handler = () => applyTheme();
    webapp.onEvent('themeChanged', handler);

    return () => {
      webapp.offEvent('themeChanged', handler);
    };
  }, []);
}
