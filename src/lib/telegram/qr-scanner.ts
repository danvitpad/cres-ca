/** --- YAML
 * name: Telegram QR Scanner
 * description: Native Telegram QR scanner with web fallback
 * --- */

'use client';

import { tg, isTelegram } from './webapp';

/**
 * Open QR scanner. In Telegram, uses native scanner.
 * Returns the scanned URL/text or null if cancelled.
 */
export function scanQR(promptText?: string): Promise<string | null> {
  if (isTelegram()) {
    return new Promise((resolve) => {
      tg()!.showScanQrPopup(
        { text: promptText ?? 'Scan QR code' },
        (result) => {
          if (result) {
            tg()!.closeScanQrPopup();
            resolve(result);
            return true;
          }
          return false;
        },
      );
      // If user closes the popup without scanning
      setTimeout(() => resolve(null), 30000);
    });
  }

  // Web fallback: no native scanner available
  return Promise.resolve(null);
}

/**
 * Extract path from a CRES-CA URL for navigation.
 * Input: "https://cres-ca.com/uk/masters/uuid" → "/uk/masters/uuid"
 */
export function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}
