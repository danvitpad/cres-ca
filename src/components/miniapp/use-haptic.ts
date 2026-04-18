/** --- YAML
 * name: useHaptic
 * description: Haptic feedback hook for Telegram Mini App. Falls back to a no-op outside the WebView.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback } from 'react';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'success' | 'error' | 'warning';

type TgHaptic = {
  impactOccurred?: (style: HapticStyle) => void;
  notificationOccurred?: (type: HapticNotification) => void;
  selectionChanged?: () => void;
};

function getHaptic(): TgHaptic | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { HapticFeedback?: TgHaptic } } };
  return w.Telegram?.WebApp?.HapticFeedback ?? null;
}

export function useHaptic() {
  const impact = useCallback((style: HapticStyle = 'light') => {
    getHaptic()?.impactOccurred?.(style);
  }, []);

  const notification = useCallback((type: HapticNotification) => {
    getHaptic()?.notificationOccurred?.(type);
  }, []);

  const selection = useCallback(() => {
    getHaptic()?.selectionChanged?.();
  }, []);

  return { impact, notification, selection };
}
