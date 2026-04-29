/** --- YAML
 * name: Telegram Layout
 * description: Layout for Telegram Mini App entry — includes Telegram WebApp SDK script and edge-swipe navigation (back/forward).
 * --- */

import Script from 'next/script';
import { SwipeNavigator } from '@/components/shared/swipe-navigator';

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <SwipeNavigator />
      {children}
    </>
  );
}
