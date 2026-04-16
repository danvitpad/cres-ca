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
  // Strategy 1: Telegram LocationManager (most reliable inside Mini App)
  if (isTelegram()) {
    try {
      const webapp = tg()!;
      const lm = webapp.LocationManager;

      if (!lm.isInited) {
        await withTimeout(
          new Promise<void>((resolve) => lm.init(() => resolve())),
          4000,
          undefined as unknown as void,
        );
      }

      // If location services are available, try to get location
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
          8000,
          null,
        );
        if (tgResult) return tgResult;
      }
    } catch {
      // Telegram LocationManager failed, try browser
    }
  }

  // Strategy 2: Browser geolocation (works in some WebViews)
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    const browserResult = await withTimeout(
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
          { timeout: 10000, enableHighAccuracy: true },
        );
      }),
      11000,
      null,
    );
    if (browserResult) return browserResult;
  }

  return null;
}
