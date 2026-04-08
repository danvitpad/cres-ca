/** --- YAML
 * name: Telegram Layout
 * description: Layout for Telegram Mini App entry — includes Telegram WebApp SDK script
 * --- */

import Script from 'next/script';

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {children}
    </>
  );
}
