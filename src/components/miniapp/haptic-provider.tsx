/** --- YAML
 * name: HapticProvider
 * description: Корневой провайдер Mini App тактильной отдачи. Читает enabled
 *              из profiles.haptic_enabled через /api/me/ui-prefs, кэширует
 *              в state, экспортирует через context. useHaptic() читает enabled
 *              из этого контекста и no-op'ит если выключено.
 * created: 2026-05-09
 * --- */

'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setHapticEnabled } from '@/lib/telegram/webapp';

interface HapticPrefsContext {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (next: boolean) => void;
}

const Ctx = createContext<HapticPrefsContext>({
  enabled: true,
  loaded: false,
  setEnabled: () => {},
});

export function HapticProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/ui-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { haptic_enabled?: boolean } | null) => {
        if (cancelled) return;
        if (data && typeof data.haptic_enabled === 'boolean') {
          setEnabledState(data.haptic_enabled);
          setHapticEnabled(data.haptic_enabled);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    setHapticEnabled(next);
    fetch('/api/me/ui-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ haptic_enabled: next }),
    }).catch(() => { /* offline-tolerant */ });
  }, []);

  return <Ctx.Provider value={{ enabled, loaded, setEnabled }}>{children}</Ctx.Provider>;
}

export function useHapticPrefs() {
  return useContext(Ctx);
}
