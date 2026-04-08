/** --- YAML
 * name: Telegram WebApp SDK
 * description: Helper functions for interacting with Telegram Mini App WebApp API
 * --- */

'use client';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  ready: () => void;
  close: () => void;
  expand: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    isVisible: boolean;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp || null;
}

export function getTelegramUser(): TelegramUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user || null;
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData || '';
}

export function getStartParam(): string | undefined {
  return getTelegramWebApp()?.initDataUnsafe?.start_param;
}

export function showMainButton(text: string, onClick: () => void) {
  const webapp = getTelegramWebApp();
  if (!webapp) return;
  webapp.MainButton.text = text;
  webapp.MainButton.onClick(onClick);
  webapp.MainButton.show();
}

export function hideMainButton() {
  getTelegramWebApp()?.MainButton.hide();
}

export function hapticFeedback(type: 'success' | 'error' | 'warning' = 'success') {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred(type);
}

export function closeMiniApp() {
  getTelegramWebApp()?.close();
}
