# PHASE 23: TELEGRAM MINI APP — DEEP NATIVE INTEGRATION

> Fullscreen, haptics, Telegram payments, QR scanner, home screen, stories sharing, geolocation, biometrics, cloud storage. 99% users on mobile — this makes the app feel native.

**Context:** Phase 10 created basic Mini App shell. This phase exploits every Telegram Mini App API (Bot API 8.0-9.6). Reference: https://core.telegram.org/bots/webapps

- [x] **23.1 — Full Telegram SDK helper rewrite**
  - **Rewrite:** `src/lib/telegram/webapp.ts`
  - **What:** Complete typed wrapper around `window.Telegram.WebApp`. Detect if running in Telegram or browser, gracefully degrade.
  - **Type definitions:**
    ```tsx
    interface TelegramWebApp {
      initData: string;
      initDataUnsafe: WebAppInitData;
      version: string;
      platform: string;
      colorScheme: 'light' | 'dark';
      themeParams: ThemeParams;
      isExpanded: boolean;
      isFullscreen: boolean;
      isActive: boolean;
      viewportHeight: number;
      viewportStableHeight: number;
      safeAreaInset: { top: number; bottom: number; left: number; right: number };
      contentSafeAreaInset: { top: number; bottom: number; left: number; right: number };
      MainButton: BottomButton;
      SecondaryButton: BottomButton;
      BackButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
      SettingsButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void };
      HapticFeedback: HapticFeedback;
      CloudStorage: CloudStorage;
      BiometricManager: BiometricManager;
      LocationManager: LocationManager;
    }
    ```
  - **Helper functions:**
    ```tsx
    export const tg = () => window.Telegram?.WebApp;
    export const isTelegram = () => !!window.Telegram?.WebApp?.initData;
    export const haptic = {
      impact: (style: 'light' | 'medium' | 'heavy') => tg()?.HapticFeedback?.impactOccurred(style),
      success: () => tg()?.HapticFeedback?.notificationOccurred('success'),
      error: () => tg()?.HapticFeedback?.notificationOccurred('error'),
      selection: () => tg()?.HapticFeedback?.selectionChanged(),
    };
    ```

- [x] **23.2 — Fullscreen mode + safe areas**
  - **Modify:** `src/app/telegram/page.tsx`
  - **What:** On app load:
    1. `WebApp.requestFullscreen()`
    2. `WebApp.disableVerticalSwipes()`
    3. `WebApp.enableClosingConfirmation()`
    4. `WebApp.expand()`
    5. `WebApp.ready()`
  - **Safe areas:** Use Telegram CSS vars:
    ```css
    .tg-app {
      padding-top: var(--tg-content-safe-area-inset-top, 0px);
      padding-bottom: var(--tg-safe-area-inset-bottom, 0px);
      padding-left: var(--tg-safe-area-inset-left, 0px);
      padding-right: var(--tg-safe-area-inset-right, 0px);
    }
    ```
  - **Colors:** Match Telegram:
    ```tsx
    WebApp.setHeaderColor('#000000');
    WebApp.setBackgroundColor('#000000');
    WebApp.setBottomBarColor('#000000');
    ```
  - **Orientation:** Lock portrait: `WebApp.lockOrientation()`

- [x] **23.3 — Telegram theme sync**
  - **Create:** `src/hooks/use-telegram-theme.ts`
  - **What:** Hook reads `WebApp.themeParams`, maps to our CSS variables.
  - **Mappings:**
    ```
    --tg-theme-bg-color → --surface-primary
    --tg-theme-text-color → foreground
    --tg-theme-hint-color → muted-foreground
    --tg-theme-link-color → --accent
    --tg-theme-button-color → --accent
    --tg-theme-button-text-color → accent-foreground
    --tg-theme-secondary-bg-color → --surface-secondary
    --tg-theme-section-bg-color → --surface-elevated
    --tg-theme-bottom-bar-bg-color → bottom tab bar bg
    --tg-color-scheme → dark/light toggle
    ```
  - Listen to `themeChanged` event. Use `--tg-viewport-stable-height` instead of `100vh` to avoid keyboard flicker.

- [x] **23.4 — Telegram MainButton + BackButton integration**
  - **Create:** `src/hooks/use-telegram-buttons.ts`
  - **What:** Hook for controlling Telegram native buttons:
    ```tsx
    export function useTelegramMainButton(text: string, onClick: () => void, options?: {
      color?: string; textColor?: string; isActive?: boolean; hasShineEffect?: boolean;
    }) {
      useEffect(() => {
        if (!isTelegram()) return;
        const btn = tg().MainButton;
        btn.setText(text);
        if (options?.color) btn.color = options.color;
        if (options?.hasShineEffect) btn.hasShineEffect = true;
        btn.onClick(onClick);
        btn.show();
        return () => { btn.offClick(onClick); btn.hide(); };
      }, [text, onClick]);
    }
    ```
  - **Usage:** Booking confirmation → "Confirm Booking" (shine). Master calendar → "New Appointment". Payment → "Pay {amount}" with spinner. BackButton shows on nested pages.

- [x] **23.5 — Haptic feedback everywhere**
  - **Rules:**
    - `haptic.selection()` → tab switch, toggle, radio
    - `haptic.impact('light')` → button tap, card tap
    - `haptic.impact('medium')` → drag-drop grab/release
    - `haptic.impact('heavy')` → pull-to-refresh trigger
    - `haptic.success()` → booking confirmed, payment success, review submitted
    - `haptic.error()` → validation fail, booking conflict, payment fail
  - No-op outside Telegram (safe everywhere).

- [x] **23.6 — Telegram CloudStorage for preferences**
  - **Create:** `src/lib/telegram/cloud-storage.ts`
  - **What:** Store user preferences (1024 items, persists across devices):
    - `preferred_locale`, `last_viewed_tab`, `favorite_master_ids`, `notification_preferences`, `theme_override`
  - **Fallback:** `localStorage` outside Telegram.
  - **Pattern:**
    ```tsx
    export async function getCloudItem(key: string): Promise<string | null> {
      if (isTelegram()) {
        return new Promise(resolve => tg().CloudStorage.getItem(key, (err, val) => resolve(val || null)));
      }
      return localStorage.getItem(key);
    }
    ```

- [x] **23.7 — Telegram QR scanner for master codes**
  - **What:** In Telegram, use native QR scanner:
    ```tsx
    function scanMasterQR() {
      if (isTelegram()) {
        tg().showScanQrPopup({ text: 'Scan master QR code' }, (result) => {
          if (result) {
            router.push(extractPath(result));
            tg().closeScanQrPopup();
          }
        });
      } else {
        // Web fallback: open camera with jsQR library
      }
    }
    ```
  - **Add to:** Client masters tab — "Scan QR" button next to search bar.

- [x] **23.8 — Telegram geolocation for nearby masters**
  - **What:** Use `LocationManager` instead of `navigator.geolocation`:
    ```tsx
    async function getLocation(): Promise<{lat: number, lng: number} | null> {
      if (isTelegram()) {
        const lm = tg().LocationManager;
        if (!lm.isInited) await new Promise(r => lm.init(r));
        if (!lm.isLocationAvailable) return null;
        return new Promise(resolve => lm.getLocation((data) => {
          resolve(data ? { lat: data.latitude, lng: data.longitude } : null);
        }));
      }
      return new Promise(resolve => navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null)
      ));
    }
    ```

- [x] **23.9 — Add to Home Screen prompt**
  - **Create:** `src/components/shared/home-screen-prompt.tsx`
  - **What:** After 3rd use (or after first booking), show subtle banner `t('tg.addToHome')`. On tap: `tg().addToHomeScreen()`.
  - **Track:** CloudStorage `home_screen_prompted: true`.
  - **Check:** `tg().checkHomeScreenStatus()` — if already added, don't show.

- [x] **23.10 — Biometric auth for sensitive actions**
  - **What:** Optionally require biometric for payments, viewing client health, consent forms:
    ```tsx
    async function requireBiometric(reason: string): Promise<boolean> {
      if (!isTelegram()) return true;
      const bm = tg().BiometricManager;
      if (!bm.isInited) await new Promise(r => bm.init(r));
      if (!bm.isBiometricAvailable) return true;
      return new Promise(resolve => bm.authenticate({ reason }, (success) => resolve(success)));
    }
    ```

- [x] **23.11 — Telegram-native popups and confirmations**
  - **What:** In Telegram, native popups instead of web:
    ```tsx
    export function showConfirm(message: string): Promise<boolean> {
      if (isTelegram()) {
        return new Promise(resolve => tg().showConfirm(message, resolve));
      }
      return Promise.resolve(window.confirm(message));
    }
    export function showAlert(message: string): Promise<void> {
      if (isTelegram()) {
        return new Promise(resolve => tg().showAlert(message, resolve));
      }
      window.alert(message);
      return Promise.resolve();
    }
    ```
  - **Custom popups:**
    ```tsx
    tg().showPopup({
      title: 'Cancel booking?',
      message: 'Cancellation fee may apply.',
      buttons: [
        { id: 'cancel', type: 'destructive', text: 'Yes, cancel' },
        { id: 'keep', type: 'default', text: 'Keep booking' },
      ]
    }, (buttonId) => { if (buttonId === 'cancel') cancelBooking(); });
    ```

- [x] **23.12 — Verify Phase 23**
  - Mini App opens fullscreen. Safe areas correct on all devices. Haptic feedback on all interactions. Theme syncs with Telegram. MainButton shows contextually. QR scanner opens natively. Location works. Home screen prompt shows. Biometrics gate sensitive actions. Native popups replace browser confirms.
  - Test on: iOS Telegram, Android Telegram, Telegram Desktop (graceful degradation)
  - `npm run build` passes
