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
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    });
  });
}

export async function getLocation(): Promise<GeoPosition | null> {
  if (isTelegram()) {
    try {
      const lm = tg()!.LocationManager;

      if (!lm.isInited) {
        await withTimeout(
          new Promise<void>((resolve) => lm.init(() => resolve())),
          3000,
          undefined as unknown as void,
        );
      }

      if (lm.isLocationAvailable) {
        const tgResult = await withTimeout(
          new Promise<GeoPosition | null>((resolve) => {
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
          }),
          6000,
          null,
        );
        if (tgResult) return tgResult;
      }
    } catch {}
  }

  // Browser fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  return withTimeout(
    new Promise<GeoPosition | null>((resolve) => {
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
        { timeout: 8000, enableHighAccuracy: false },
      );
    }),
    9000,
    null,
  );
}
