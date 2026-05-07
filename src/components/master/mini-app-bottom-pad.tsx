/** --- YAML
 * name: MiniAppBottomPad
 * description: Detects Telegram Mini App context and exposes a CSS variable
 *              `--mini-app-bottom-pad` on documentElement. Used by sticky
 *              bottom CTA on /m/[handle] to lift the button above the
 *              floating-pill bottom-nav of the Mini App client (~84px). On
 *              regular web — variable is `0px`, behaviour unchanged.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect } from 'react';

interface TelegramWebAppLite {
  initData?: string;
  platform?: string;
}

export function MiniAppBottomPad() {
  useEffect(() => {
    const tg = (window as { Telegram?: { WebApp?: TelegramWebAppLite } }).Telegram?.WebApp;
    const inMiniApp = !!tg?.initData;
    const root = document.documentElement;
    if (inMiniApp) {
      // 64px (floating-pill nav height) + 20px (gap above nav).
      root.style.setProperty('--mini-app-bottom-pad', '84px');
    }
    return () => {
      if (inMiniApp) root.style.removeProperty('--mini-app-bottom-pad');
    };
  }, []);

  return null;
}
