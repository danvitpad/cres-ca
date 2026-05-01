/* CRES-CA Service Worker — Web Push handler.
 *
 * Receives push events from our backend (signed with VAPID via web-push npm
 * pkg) and renders a system notification. Click on a notification deep-links
 * the user into the app at the URL supplied in the payload.
 */

self.addEventListener('install', () => {
  // Активируем SW сразу, без ожидания закрытия табов
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Берём контроль над уже открытыми вкладками
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CRES-CA', body: event.data.text() };
  }

  const title = payload.title || 'CRES-CA';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || undefined,        // Дедуп: одинаковый tag заменит предыдущее
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    data: { url: payload.url || '/', ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Если уже открыта вкладка с нашим origin — переключаемся, иначе открываем новую
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            client.focus();
            if ('navigate' in client) client.navigate(target);
            return;
          }
        } catch { /* ignore */ }
      }
      return self.clients.openWindow(target);
    }),
  );
});
