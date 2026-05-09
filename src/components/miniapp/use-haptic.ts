/** --- YAML
 * name: useHaptic
 * description: Haptic feedback hook for Telegram Mini App. Reads `enabled` from
 *              HapticProvider context — if user disabled haptics in Settings,
 *              all methods become no-ops. Falls back to enabled=true outside
 *              the provider (drop-in compatible with old callsites).
 * created: 2026-04-18
 * updated: 2026-05-09
 * --- */

'use client';

import { useCallback } from 'react';
import { useHapticPrefs } from './haptic-provider';

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
  const { enabled } = useHapticPrefs();

  const impact = useCallback((style: HapticStyle = 'light') => {
    if (!enabled) return;
    getHaptic()?.impactOccurred?.(style);
  }, [enabled]);

  const notification = useCallback((type: HapticNotification) => {
    if (!enabled) return;
    getHaptic()?.notificationOccurred?.(type);
  }, [enabled]);

  const selection = useCallback(() => {
    if (!enabled) return;
    getHaptic()?.selectionChanged?.();
  }, [enabled]);

  return { impact, notification, selection };
}
