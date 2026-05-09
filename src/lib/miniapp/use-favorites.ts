/** --- YAML
 * name: useFavorites
 * description: >
 *   Persists a list of favourite master profile IDs in Telegram CloudStorage
 *   (falls back to localStorage in browser). Key: "fav:masters".
 * created: 2026-05-09
 * --- */

import { useCallback, useEffect, useState } from 'react';
import { csGet, csSet } from '@/lib/miniapp/cloud-storage';

const KEY = 'fav:masters';

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    csGet(KEY).then((raw) => {
      setIds(parse(raw));
      setLoaded(true);
    });
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback(async (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    await csSet(KEY, JSON.stringify(next));
  }, [ids]);

  return { isFavorite, toggle, loaded };
}
