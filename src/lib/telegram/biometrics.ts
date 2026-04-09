/** --- YAML
 * name: Telegram Biometrics
 * description: Biometric authentication via Telegram BiometricManager with graceful fallback
 * --- */

'use client';

import { tg, isTelegram } from './webapp';

/**
 * Require biometric verification for sensitive actions.
 * Returns true if verified or if biometrics are unavailable (graceful skip).
 * Returns false only if user explicitly denies verification.
 */
export async function requireBiometric(reason: string): Promise<boolean> {
  if (!isTelegram()) return true;

  const bm = tg()!.BiometricManager;

  if (!bm.isInited) {
    await new Promise<void>((resolve) => bm.init(() => resolve()));
  }

  if (!bm.isBiometricAvailable) return true;

  if (!bm.isAccessGranted) {
    const granted = await new Promise<boolean>((resolve) => {
      bm.requestAccess({ reason }, (success) => resolve(success));
    });
    if (!granted) return true; // User declined biometric setup, allow anyway
  }

  return new Promise<boolean>((resolve) => {
    bm.authenticate({ reason }, (success) => resolve(success));
  });
}
