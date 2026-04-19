/** --- YAML
 * name: TelegramProvider
 * description: Context wrapper exposing Telegram.WebApp to children — handles ready/expand, back button routing, haptics. Thin layer over src/lib/telegram/webapp.ts.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tg, haptic as hapticApi, getTelegramUser } from '@/lib/telegram/webapp';

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramContextValue {
  ready: boolean;
  user: TgUser | null;
  haptic: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection') => void;
}

const TelegramContext = createContext<TelegramContextValue>({
  ready: false,
  user: null,
  haptic: () => {},
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function syncSafeArea(webapp: ReturnType<typeof tg>) {
      if (!webapp) return;
      const root = document.documentElement;
      const csa = webapp.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
      const sa = webapp.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
      root.style.setProperty('--tg-content-top', `${csa.top}px`);
      root.style.setProperty('--tg-content-bottom', `${csa.bottom}px`);
      root.style.setProperty('--tg-safe-top', `${sa.top}px`);
      root.style.setProperty('--tg-safe-bottom', `${sa.bottom}px`);
      root.style.setProperty('--tg-viewport-height', `${webapp.viewportStableHeight || webapp.viewportHeight || window.innerHeight}px`);
    }

    function syncTheme(webapp: ReturnType<typeof tg>) {
      if (!webapp) return;
      const root = document.documentElement;
      const tp = webapp.themeParams ?? {};
      if (tp.bg_color) root.style.setProperty('--tg-bg', tp.bg_color);
      if (tp.text_color) root.style.setProperty('--tg-text', tp.text_color);
      if (tp.hint_color) root.style.setProperty('--tg-hint', tp.hint_color);
      if (tp.section_bg_color) root.style.setProperty('--tg-section', tp.section_bg_color);
    }

    function init() {
      if (cancelled) return;
      const webapp = tg();
      if (!webapp) {
        if (attempts++ < 20) {
          setTimeout(init, 100);
          return;
        }
        setReady(true);
        return;
      }
      webapp.ready();
      webapp.expand();
      try { webapp.disableVerticalSwipes(); } catch {}
      try { webapp.setHeaderColor('#111214'); } catch {}
      try { webapp.setBackgroundColor('#111214'); } catch {}
      try { webapp.setBottomBarColor('#111214'); } catch {}

      syncSafeArea(webapp);
      syncTheme(webapp);

      const onViewport = () => syncSafeArea(webapp);
      const onTheme = () => syncTheme(webapp);
      try { webapp.onEvent('viewportChanged', onViewport); } catch {}
      try { webapp.onEvent('safeAreaChanged', onViewport); } catch {}
      try { webapp.onEvent('contentSafeAreaChanged', onViewport); } catch {}
      try { webapp.onEvent('themeChanged', onTheme); } catch {}

      setUser(getTelegramUser() ?? null);
      setReady(true);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const webapp = tg();
    if (!webapp) return;
    const handler = () => router.back();
    webapp.BackButton.onClick(handler);
    return () => webapp.BackButton.offClick(handler);
  }, [router]);

  const haptic = useCallback<TelegramContextValue['haptic']>((type = 'light') => {
    try {
      if (type === 'success' || type === 'error' || type === 'warning') hapticApi[type]();
      else if (type === 'selection') hapticApi.selection();
      else hapticApi.impact(type);
    } catch {}
  }, []);

  return (
    <TelegramContext.Provider value={{ ready, user, haptic }}>
      {children}
    </TelegramContext.Provider>
  );
}
