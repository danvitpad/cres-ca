/** --- YAML
 * name: Telegram Cloud Storage
 * description: Persistent key-value storage using Telegram CloudStorage with localStorage fallback
 * --- */

'use client';

import { tg, isTelegram } from './webapp';

export async function getCloudItem(key: string): Promise<string | null> {
  if (isTelegram()) {
    return new Promise((resolve) => {
      tg()!.CloudStorage.getItem(key, (_err, val) => resolve(val || null));
    });
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

export async function setCloudItem(key: string, value: string): Promise<void> {
  if (isTelegram()) {
    return new Promise((resolve) => {
      tg()!.CloudStorage.setItem(key, value, () => resolve());
    });
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

export async function removeCloudItem(key: string): Promise<void> {
  if (isTelegram()) {
    return new Promise((resolve) => {
      tg()!.CloudStorage.removeItem(key, () => resolve());
    });
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
}

export async function getCloudItems(keys: string[]): Promise<Record<string, string>> {
  if (isTelegram()) {
    return new Promise((resolve) => {
      tg()!.CloudStorage.getItems(keys, (_err, values) => resolve(values ?? {}));
    });
  }
  const result: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) result[key] = val;
    }
  }
  return result;
}

// Predefined storage keys
export const CLOUD_KEYS = {
  PREFERRED_LOCALE: 'preferred_locale',
  LAST_VIEWED_TAB: 'last_viewed_tab',
  FAVORITE_MASTER_IDS: 'favorite_master_ids',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  THEME_OVERRIDE: 'theme_override',
  HOME_SCREEN_PROMPTED: 'home_screen_prompted',
} as const;
