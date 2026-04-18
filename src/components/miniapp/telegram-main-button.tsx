/** --- YAML
 * name: TelegramMainButton
 * description: Controls the native Telegram WebApp MainButton — sets text + click handler + progress/loading state.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect } from 'react';

type MainButton = {
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

function getMainButton(): MainButton | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { MainButton?: MainButton } } };
  return w.Telegram?.WebApp?.MainButton ?? null;
}

export function TelegramMainButton({
  text,
  onClick,
  disabled,
  loading,
}: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  useEffect(() => {
    const btn = getMainButton();
    if (!btn) return;
    btn.setText(text);
    btn.show();
    if (disabled) btn.disable();
    else btn.enable();
    if (loading) btn.showProgress(true);
    else btn.hideProgress();
    btn.onClick(onClick);
    return () => {
      btn.offClick(onClick);
      btn.hideProgress();
      btn.hide();
    };
  }, [text, onClick, disabled, loading]);

  return null;
}
