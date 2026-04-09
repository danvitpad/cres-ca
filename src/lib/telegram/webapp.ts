/** --- YAML
 * name: Telegram WebApp SDK
 * description: Complete typed wrapper around Telegram Mini App WebApp API (Bot API 8.0-9.6)
 * --- */

'use client';

// --- Type Definitions ---

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

interface WebAppInitData {
  user?: TelegramUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  section_separator_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  destructive_text_color?: string;
  subtitle_text_color?: string;
  section_header_text_color?: string;
}

interface BottomButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  hasShineEffect: boolean;
  position: 'left' | 'right' | 'top' | 'bottom';
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  setText(text: string): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
}

interface BackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface SettingsButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface HapticFeedbackApi {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

interface CloudStorageApi {
  getItem(key: string, cb: (err: string | null, value: string) => void): void;
  setItem(key: string, value: string, cb?: (err: string | null, success: boolean) => void): void;
  removeItem(key: string, cb?: (err: string | null, success: boolean) => void): void;
  getItems(keys: string[], cb: (err: string | null, values: Record<string, string>) => void): void;
  removeItems(keys: string[], cb?: (err: string | null, success: boolean) => void): void;
  getKeys(cb: (err: string | null, keys: string[]) => void): void;
}

interface BiometricManager {
  isInited: boolean;
  isBiometricAvailable: boolean;
  biometricType: 'finger' | 'face' | 'unknown';
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  init(cb?: () => void): void;
  requestAccess(params: { reason: string }, cb?: (granted: boolean) => void): void;
  authenticate(params: { reason: string }, cb?: (success: boolean, token?: string) => void): void;
  updateBiometricToken(token: string, cb?: (updated: boolean) => void): void;
  openSettings(): void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  course?: number;
  speed?: number;
  horizontal_accuracy?: number;
  vertical_accuracy?: number;
}

interface LocationManager {
  isInited: boolean;
  isLocationAvailable: boolean;
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  init(cb?: () => void): void;
  getLocation(cb: (data: LocationData | null) => void): void;
  openSettings(): void;
}

interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface PopupButton {
  id: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

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
  safeAreaInset: SafeAreaInset;
  contentSafeAreaInset: SafeAreaInset;
  MainButton: BottomButton;
  SecondaryButton: BottomButton;
  BackButton: BackButton;
  SettingsButton: SettingsButton;
  HapticFeedback: HapticFeedbackApi;
  CloudStorage: CloudStorageApi;
  BiometricManager: BiometricManager;
  LocationManager: LocationManager;

  ready(): void;
  close(): void;
  expand(): void;
  requestFullscreen(): void;
  exitFullscreen(): void;
  lockOrientation(): void;
  unlockOrientation(): void;
  disableVerticalSwipes(): void;
  enableVerticalSwipes(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor(color: string): void;
  addToHomeScreen(): void;
  checkHomeScreenStatus(cb: (status: string) => void): void;
  showPopup(params: PopupParams, cb?: (buttonId: string) => void): void;
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb?: (confirmed: boolean) => void): void;
  showScanQrPopup(params: { text?: string }, cb: (result: string) => boolean | void): void;
  closeScanQrPopup(): void;
  switchInlineQuery(query: string, chatTypes?: string[]): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  shareToStory(mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name?: string } }): void;

  onEvent(eventType: string, cb: () => void): void;
  offEvent(eventType: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

// --- Helper Functions ---

export function tg(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  return !!tg()?.initData;
}

export const getTelegramWebApp = tg;

export function getTelegramUser(): TelegramUser | null {
  return tg()?.initDataUnsafe?.user ?? null;
}

export function getInitData(): string {
  return tg()?.initData ?? '';
}

export function getStartParam(): string | undefined {
  return tg()?.initDataUnsafe?.start_param;
}

// --- Haptic Feedback ---

export const haptic = {
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    tg()?.HapticFeedback?.impactOccurred(style);
  },
  success: () => {
    tg()?.HapticFeedback?.notificationOccurred('success');
  },
  error: () => {
    tg()?.HapticFeedback?.notificationOccurred('error');
  },
  warning: () => {
    tg()?.HapticFeedback?.notificationOccurred('warning');
  },
  selection: () => {
    tg()?.HapticFeedback?.selectionChanged();
  },
};

// --- Main Button ---

export function showMainButton(text: string, onClick: () => void) {
  const webapp = tg();
  if (!webapp) return;
  webapp.MainButton.setText(text);
  webapp.MainButton.onClick(onClick);
  webapp.MainButton.show();
}

export function hideMainButton() {
  tg()?.MainButton.hide();
}

// --- Popups ---

export function showAlert(message: string): Promise<void> {
  if (isTelegram()) {
    return new Promise((resolve) => tg()!.showAlert(message, resolve));
  }
  window.alert(message);
  return Promise.resolve();
}

export function showConfirm(message: string): Promise<boolean> {
  if (isTelegram()) {
    return new Promise((resolve) => tg()!.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

export function showPopup(params: PopupParams): Promise<string> {
  if (isTelegram()) {
    return new Promise((resolve) => tg()!.showPopup(params, resolve));
  }
  // Fallback: use first destructive or last button
  const result = window.confirm(params.message);
  const buttons = params.buttons ?? [];
  const id = result
    ? (buttons.find((b) => b.type === 'destructive')?.id ?? buttons[0]?.id ?? 'ok')
    : (buttons.find((b) => b.type === 'cancel')?.id ?? 'cancel');
  return Promise.resolve(id);
}

// --- Close ---

export function closeMiniApp() {
  tg()?.close();
}

// --- Deprecated compat ---

export function hapticFeedback(type: 'success' | 'error' | 'warning' = 'success') {
  tg()?.HapticFeedback.notificationOccurred(type);
}
