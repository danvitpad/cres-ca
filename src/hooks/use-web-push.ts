/** --- YAML
 * name: useWebPush
 * description: Browser-side hook that handles Service Worker registration,
 *              Notification permission and Push subscribe/unsubscribe flows.
 *              Sends the subscription to /api/web-push/subscribe so the server
 *              can deliver pushes via web-push npm pkg.
 * created: 2026-05-01
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';

type WebPushState = 'unsupported' | 'denied' | 'idle' | 'enabled' | 'busy';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function useWebPush() {
  const [state, setState] = useState<WebPushState>('idle');

  const detect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub ? 'enabled' : 'idle');
    } catch {
      setState('idle');
    }
  }, []);

  useEffect(() => { void detect(); }, [detect]);

  const enable = useCallback(async () => {
    if (state === 'busy') return;
    setState('busy');

    try {
      // 1) Get VAPID public key from server
      const cfg = await fetch('/api/web-push/subscribe').then((r) => r.json());
      if (!cfg?.publicKey || !cfg?.enabled) {
        // Server not configured — do nothing
        await detect();
        return;
      }

      // 2) Ask permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'idle');
        return;
      }

      // 3) Register SW and subscribe
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Cast to BufferSource — TS type for applicationServerKey expects strict
        // ArrayBuffer but Uint8Array<ArrayBufferLike> works in practice.
        const key = urlBase64ToUint8Array(cfg.publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
        });
      }

      // 4) Send to backend
      const json = sub.toJSON();
      await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent,
        }),
      });

      setState('enabled');
    } catch (err) {
      console.error('[web-push] enable failed:', err);
      await detect();
    }
  }, [state, detect]);

  const disable = useCallback(async () => {
    if (state === 'busy') return;
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const json = sub.toJSON();
        await fetch('/api/web-push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState('idle');
    } catch {
      await detect();
    }
  }, [state, detect]);

  return { state, enable, disable };
}
