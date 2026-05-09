/** --- YAML
 * name: useMainButton
 * description: >
 *   Hook that drives the Telegram MainButton lifecycle for a screen.
 *   Shows/hides/enables/disables the native button based on `active` and
 *   `loading`. Falls back to a no-op outside Telegram (browser preview).
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useRef } from 'react';
import { tg } from '@/lib/telegram/webapp';

interface UseMainButtonOptions {
  text: string;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}

export function useMainButton({ text, active, loading = false, onClick }: UseMainButtonOptions) {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const webapp = tg();
    if (!webapp) return;

    const btn = webapp.MainButton;
    const handler = () => onClickRef.current();

    if (active) {
      btn.setText(text);
      btn.onClick(handler);
      if (loading) {
        btn.showProgress(true);
        btn.disable();
      } else {
        btn.hideProgress();
        btn.enable();
      }
      btn.show();
    } else {
      btn.hide();
    }

    return () => {
      btn.offClick(handler);
      btn.hide();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loading, text]);
}
