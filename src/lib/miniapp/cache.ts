/** --- YAML
 * name: Mini App data cache
 * description: Простой in-memory кэш для данных Mini App. Stale-while-revalidate
 *              паттерн: открыл таб → данные из памяти мгновенно показываются
 *              (если были в прошлый раз), параллельно в фоне идёт fetch свежих,
 *              обновляет state + кэш. Возврат на таб = моментальный рендер вместо
 *              2-секундной паузы каждый раз.
 *
 *              TTL по умолчанию 60 секунд. Кэш живёт пока вкладка не закрыта
 *              (in-memory, не localStorage — быстрее на read и не растёт за сессию).
 * created: 2026-05-09
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CacheEntry<T = unknown> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 60_000; // 60 секунд

export function getCached<T>(key: string): T | undefined {
  return (cache.get(key)?.data as T | undefined);
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export function isFresh(key: string, ttl: number = DEFAULT_TTL_MS): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.ts < ttl;
}

/** Вытереть конкретный ключ — пригодится после mutating-операций (создал запись →
 *  кэш списка устарел, надо стереть, чтобы следующий рендер пошёл за свежим). */
export function invalidateCache(keyOrPrefix: string): void {
  if (cache.has(keyOrPrefix)) {
    cache.delete(keyOrPrefix);
    return;
  }
  // Префикс — стереть все ключи начинающиеся на это
  for (const k of cache.keys()) {
    if (k.startsWith(keyOrPrefix)) cache.delete(k);
  }
}

export function clearCache(): void {
  cache.clear();
}

/**
 * Хук «кэш + стейл-вайл-revalidate». Использование:
 *
 *     const { data, loading, refresh } = useCachedFetch(
 *       `clients:${userId}`,
 *       () => fetch('/api/telegram/m/clients', { ... }).then(r => r.json()),
 *     );
 *
 * Поведение:
 *   1. На mount — если в кэше есть свежий entry (моложе TTL) → возвращает мгновенно,
 *      loading=false. Fetch не вызывается.
 *   2. Если в кэше есть старый entry → возвращает его сразу + параллельно делает
 *      background fetch (loading=true только если данных вообще не было).
 *   3. Если кэша нет → loading=true, fetch, сохраняет в кэш.
 *
 * `key` стабильный — менять только когда меняется аргумент влияющий на ответ
 * (например `clients:${userId}:${dateIso}`).
 */
export function useCachedFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { ttl?: number; enabled?: boolean } = {},
) {
  const { ttl = DEFAULT_TTL_MS, enabled = true } = options;
  const [data, setData] = useState<T | undefined>(() => (key ? getCached<T>(key) : undefined));
  const [loading, setLoading] = useState<boolean>(() => {
    if (!key || !enabled) return false;
    return !isFresh(key, ttl);
  });
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!key || !enabled) return;
    try {
      const res = await fetcherRef.current();
      setCached(key, res);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [key, enabled]);

  useEffect(() => {
    if (!key || !enabled) return;
    // Если кэш свежий — отдаём data из useState init и не fetch'аем.
    if (isFresh(key, ttl)) {
      const fresh = getCached<T>(key);
      if (fresh !== undefined) {
        setData(fresh);
        setLoading(false);
        return;
      }
    }
    // Иначе — fetch (если кэш есть-но-старый, data уже отдан, в фоне обновим).
    void run();
  }, [key, enabled, ttl, run]);

  return { data, loading, error, refresh: run };
}
