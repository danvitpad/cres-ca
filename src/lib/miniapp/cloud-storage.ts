/** --- YAML
 * name: TelegramCloudStorage helpers
 * description: >
 *   Promise-wrapped Telegram.WebApp.CloudStorage API.
 *   Falls back to localStorage when CloudStorage is unavailable (browser / old TG).
 *   All helpers are safe to call outside Telegram — they will silently use localStorage.
 * created: 2026-05-09
 * --- */

type CS = NonNullable<typeof window extends object ? { Telegram?: { WebApp?: { CloudStorage?: unknown } } } : never>;

function cs() {
  if (typeof window === 'undefined') return null;
  return (window as { Telegram?: { WebApp?: { CloudStorage?: {
    getItem(key: string, cb: (err: string | null, val: string) => void): void;
    setItem(key: string, val: string, cb?: (err: string | null, ok: boolean) => void): void;
    removeItem(key: string, cb?: (err: string | null, ok: boolean) => void): void;
    getItems(keys: string[], cb: (err: string | null, vals: Record<string, string>) => void): void;
  } } } }).Telegram?.WebApp?.CloudStorage ?? null;
}

export function csGet(key: string): Promise<string | null> {
  const storage = cs();
  if (!storage) {
    try { return Promise.resolve(localStorage.getItem(`cs:${key}`)); } catch { return Promise.resolve(null); }
  }
  return new Promise((resolve) => {
    storage.getItem(key, (err, val) => resolve(err ? null : (val || null)));
  });
}

export function csSet(key: string, value: string): Promise<void> {
  const storage = cs();
  if (!storage) {
    try { localStorage.setItem(`cs:${key}`, value); } catch {}
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    storage.setItem(key, value, () => resolve());
  });
}

export function csRemove(key: string): Promise<void> {
  const storage = cs();
  if (!storage) {
    try { localStorage.removeItem(`cs:${key}`); } catch {}
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    storage.removeItem(key, () => resolve());
  });
}

export function csGetMany(keys: string[]): Promise<Record<string, string>> {
  const storage = cs();
  if (!storage) {
    const out: Record<string, string> = {};
    keys.forEach((k) => {
      try {
        const v = localStorage.getItem(`cs:${k}`);
        if (v != null) out[k] = v;
      } catch {}
    });
    return Promise.resolve(out);
  }
  return new Promise((resolve) => {
    storage.getItems(keys, (err, vals) => resolve(err ? {} : vals));
  });
}
