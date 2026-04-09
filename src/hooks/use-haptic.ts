/** --- YAML
 * name: useHaptic
 * description: Hook and utilities for adding Telegram haptic feedback to UI interactions
 * --- */

'use client';

import { useCallback } from 'react';
import { haptic } from '@/lib/telegram/webapp';

/**
 * Returns click handlers with haptic feedback baked in.
 * Safe to use outside Telegram — haptic calls are no-ops.
 */
export function useHaptic() {
  const tap = useCallback((fn?: () => void) => {
    return () => {
      haptic.impact('light');
      fn?.();
    };
  }, []);

  const select = useCallback((fn?: () => void) => {
    return () => {
      haptic.selection();
      fn?.();
    };
  }, []);

  const confirm = useCallback((fn?: () => void) => {
    return () => {
      haptic.success();
      fn?.();
    };
  }, []);

  const fail = useCallback((fn?: () => void) => {
    return () => {
      haptic.error();
      fn?.();
    };
  }, []);

  return { tap, select, confirm, fail };
}
