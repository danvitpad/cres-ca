/** --- YAML
 * name: Telegram Geolocation
 * description: Location access via Telegram LocationManager with browser fallback
 * --- */

'use client';

import { tg, isTelegram } from './webapp';

interface GeoPosition {
  lat: number;
  lng: number;
  altitude?: number;
  speed?: number;
  accuracy?: number;
}

/**
 * Get current user location. Uses Telegram LocationManager if available,
 * falls back to browser navigator.geolocation.
 */
export async function getLocation(): Promise<GeoPosition | null> {
  if (isTelegram()) {
    const lm = tg()!.LocationManager;

    if (!lm.isInited) {
      await new Promise<void>((resolve) => lm.init(() => resolve()));
    }

    if (!lm.isLocationAvailable) return null;

    return new Promise((resolve) => {
      lm.getLocation((data) => {
        if (data) {
          resolve({
            lat: data.latitude,
            lng: data.longitude,
            altitude: data.altitude,
            speed: data.speed,
            accuracy: data.horizontal_accuracy,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  // Browser fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude ?? undefined,
          speed: pos.coords.speed ?? undefined,
          accuracy: pos.coords.accuracy ?? undefined,
        }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: true },
    );
  });
}
