/** --- YAML
 * name: TelegramBackButton
 * description: Controls the native Telegram WebApp BackButton — show/hide + onClick. Cleans up on unmount.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect } from 'react';

type BackButton = {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

function getBackButton(): BackButton | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { BackButton?: BackButton } } };
  return w.Telegram?.WebApp?.BackButton ?? null;
}

export function TelegramBackButton({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    const btn = getBackButton();
    if (!btn) return;
    btn.show();
    btn.onClick(onBack);
    return () => {
      btn.offClick(onBack);
      btn.hide();
    };
  }, [onBack]);

  return null;
}
