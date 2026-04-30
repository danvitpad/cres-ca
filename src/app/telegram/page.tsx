/** --- YAML
 * name: Telegram Mini App Entry
 * description: Entry point — validates initData, routes to home (active user), register (profile exists but missing phone), or welcome (not linked yet). Never creates users silently.
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function TelegramEntryPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function waitForWebApp(timeoutMs = 4000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (window.Telegram?.WebApp) return window.Telegram.WebApp;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    }

    function parseInitDataFromHash(): string | null {
      // Telegram puts tgWebAppData=... in URL hash when opening WebApp in browser.
      // This is a standard fallback when window.Telegram.WebApp polyfill isn't loaded.
      try {
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash;
        const params = new URLSearchParams(rawHash);
        const data = params.get('tgWebAppData');
        return data ? decodeURIComponent(data) : null;
      } catch {
        return null;
      }
    }

    async function init() {
      const webapp = await waitForWebApp();
      let initData: string | undefined;

      if (webapp) {
        webapp.ready();
        webapp.expand();
        try { webapp.disableVerticalSwipes(); } catch {}
        try {
          const isDark = (webapp as { colorScheme?: 'light' | 'dark' }).colorScheme === 'dark';
          const bg = isDark ? '#141417' : '#ffffff';
          webapp.setHeaderColor(bg);
          webapp.setBackgroundColor(bg);
          webapp.setBottomBarColor(bg);
        } catch {}
        initData = webapp.initData;
      } else {
        // No Telegram polyfill (e.g. browser opened via shared web-app link) —
        // fall back to parsing initData from URL hash. Same HMAC validation
        // is enforced server-side in /api/telegram/auth.
        const hashData = parseInitDataFromHash();
        if (hashData) initData = hashData;
      }

      if (!initData) {
        setError('Откройте это приложение из Telegram');
        return;
      }

      const res = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(`Ошибка входа: ${j.error ?? res.status}`);
        return;
      }

      const data = await res.json();
      const startParam = webapp?.initDataUnsafe?.start_param ?? null;

      // Always stash initData + tg data for subsequent pages
      sessionStorage.setItem(
        'cres:tg',
        JSON.stringify({ initData, tgData: data.tgData ?? null, startParam }),
      );

      if (data.linked && !data.needsRegistration) {
        setAuth(data.userId, data.role, data.tier, data.fullName);

        // Deep link: u_<publicId|slug> → public Instagram-style profile page
        if (startParam?.startsWith('u_')) {
          const raw = startParam.slice(2);
          // 6-char CRES-ID vs slug
          if (/^[0-9A-Z]{6}$/.test(raw)) {
            router.replace(`/telegram/u/${raw}`);
          } else {
            try {
              const r = await fetch(`/api/u/slug/${encodeURIComponent(raw)}`);
              if (r.ok) {
                const j = await r.json();
                router.replace(`/telegram/u/${j.publicId}`);
                return;
              }
            } catch {}
            router.replace('/telegram/home');
          }
          return;
        }

        if (startParam?.startsWith('master_')) {
          router.replace(`/telegram/home?master=${startParam.replace('master_', '')}`);
        } else if (data.role === 'master' || data.role === 'salon_admin') {
          router.replace('/telegram/m/home');
        } else {
          router.replace('/telegram/home');
        }
        return;
      }

      if (data.linked && data.needsRegistration) {
        // Profile exists but missing required fields → complete registration
        setAuth(data.userId, data.role, data.tier, data.fullName);
        router.replace('/telegram/register');
        return;
      }

      // Not linked yet → welcome/consent
      router.replace('/telegram/welcome');
    }

    init();
  }, [router, setAuth]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-neutral-900">
      {error ? (
        <div className="text-center space-y-2 px-6">
          <p className="text-rose-400">{error}</p>
          <p className="text-sm text-neutral-500">Попробуйте перезапустить мини-приложение</p>
        </div>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-neutral-700" />
          <p className="text-sm text-neutral-500">Загрузка CRES-CA…</p>
        </>
      )}
    </div>
  );
}
