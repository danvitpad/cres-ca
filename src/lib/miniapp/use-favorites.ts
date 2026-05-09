/** --- YAML
 * name: useFavorites
 * description: >
 *   Persists favourite master profile IDs in Supabase (client_master_links).
 *   Survives Telegram reinstall, cache clears, and device switches.
 *   Uses /api/telegram/c/favorites — supports both cookie and X-TG-Init-Data auth.
 * created: 2026-05-09
 * --- */

import { useCallback, useEffect, useState } from 'react';

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch {}
  return null;
}

function headers(): Record<string, string> {
  const initData = getInitData();
  return { 'Content-Type': 'application/json', ...(initData ? { 'X-TG-Init-Data': initData } : {}) };
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/telegram/c/favorites', { headers: headers() })
      .then((r) => r.ok ? r.json() : null)
      .then((json: { masterProfileIds?: string[] } | null) => {
        setIds(json?.masterProfileIds ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const isFavorite = useCallback((profileId: string) => ids.includes(profileId), [ids]);

  const toggle = useCallback(async (masterProfileId: string) => {
    const wasFavorited = ids.includes(masterProfileId);
    // Optimistic update
    setIds((prev) => wasFavorited ? prev.filter((x) => x !== masterProfileId) : [...prev, masterProfileId]);
    const res = await fetch('/api/telegram/c/favorites', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ masterProfileId }),
    }).catch(() => null);
    if (!res?.ok) {
      // Rollback on failure
      setIds((prev) => wasFavorited ? [...prev, masterProfileId] : prev.filter((x) => x !== masterProfileId));
    }
  }, [ids]);

  return { isFavorite, toggle, loaded };
}
