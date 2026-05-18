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
      // Глобальное правило мини-аппа (мастер + клиент): контент должен лежать
      // на пару пикселей ниже плавающих нативных кнопок Telegram (Закрыть /
      // стрелка / меню). В compact iOS Telegram эти pill-кнопки плавают
      // поверх — contentSafeAreaInset.top их не учитывает и контент залезает
      // прямо под них. В fullscreen своего хедера нет, но pill'ы те же.
      // Резервируем высоту pill-кнопок (≈48px) + 8px воздуха в обоих режимах.
      const w = webapp as unknown as { isExpanded?: boolean; isFullscreen?: boolean };
      const isFullscreen = w.isFullscreen === true;
      const CHROME_PILL = 48; // высота плавающих кнопок Telegram
      const SAFE_GAP = 8;     // воздух между pill'ами и контентом
      const topInset = isFullscreen
        ? sa.top + CHROME_PILL + SAFE_GAP
        : Math.max(csa.top, sa.top + CHROME_PILL) + SAFE_GAP;
      root.style.setProperty('--tg-content-top', `${topInset}px`);
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
      // Detect real Telegram (non-empty initData). В обычном Chrome / DevTools
      // mobile mode мок TG WebApp есть, но его методы 6.0+ спамят
      // "method is not supported" в консоль — пропускаем.
      const isRealTg = !!webapp.initData;
      if (isRealTg) {
        try { webapp.requestFullscreen(); } catch {}
        try { webapp.disableVerticalSwipes(); } catch {}
      }
      // Re-sync insets after fullscreen animation settles (~400ms)
      setTimeout(() => syncSafeArea(webapp), 400);
      try { webapp.onEvent('fullscreenChanged' as Parameters<typeof webapp.onEvent>[0], () => syncSafeArea(webapp)); } catch {}
      // Initial chrome paint — hex, точно совпадает с --m-bg в globals.css.
      // Один цвет во всех точках входа Mini App (telegram/page → welcome →
      // register → m/layout). Раньше keyword 'bg_color' возвращал тон
      // Telegram-темы пользователя, который не совпадал с нашим --m-bg
      // (#141417), и было видно «горб» при переходе welcome → m/layout.
      if (isRealTg) {
        try {
          // Мастерский Mini App всегда светлый — нативный chrome Telegram
          // тоже красим белым, иначе при overscroll/MainButton видно тёмный зазор
          // когда у пользователя Telegram в dark-mode.
          webapp.setHeaderColor('#ffffff');
          webapp.setBackgroundColor('#ffffff');
          webapp.setBottomBarColor('#ffffff');
        } catch {}
      }

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
