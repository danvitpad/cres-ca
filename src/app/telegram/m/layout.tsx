/** --- YAML
 * name: TelegramMasterMiniAppLayout
 * description: Master Mini App shell — dark theme, 5-tab bottom bar (Today, Calendar, Clients, Finance, Profile). Notifications promoted to a bell icon in the top-right header with unread badge.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Calendar, Users, User, Bell, TrendingUp, Loader2 } from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { BottomTabs, type BottomTab } from '@/components/miniapp/bottom-tabs';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';

export default function MasterMiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [checking, setChecking] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const isSalonContext = pathname.startsWith('/telegram/m/salon/');

  useEffect(() => {
    if (isSalonContext) {
      setChecking(false);
      return;
    }
    if (!userId) {
      router.replace('/telegram');
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (!data) {
        router.replace('/telegram/home');
        return;
      }
      setChecking(false);
    })();
  }, [userId, router, isSalonContext]);

  // Unread notifications badge — polled (Telegram WebView doesn't keep
  // Supabase JWT, so realtime channels won't authenticate either)
  useEffect(() => {
    if (isSalonContext) return;
    if (!userId) return;
    let mounted = true;

    const fetchCount = async () => {
      const initData = (() => {
        if (typeof window === 'undefined') return null;
        const w = window as { Telegram?: { WebApp?: { initData?: string } } };
        const live = w.Telegram?.WebApp?.initData;
        if (live) return live;
        try {
          const stash = sessionStorage.getItem('cres:tg');
          if (stash) {
            const parsed = JSON.parse(stash) as { initData?: string };
            if (parsed.initData) return parsed.initData;
          }
        } catch { /* ignore */ }
        return null;
      })();
      if (!initData) return;
      const res = await fetch('/api/telegram/m/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (mounted) setUnreadCount(json.unread ?? 0);
    };

    fetchCount();

    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(fetchCount, 60_000);

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    if (pathname === '/telegram/m/notifications' && unreadCount > 0) {
      const t = setTimeout(() => setUnreadCount(0), 1500);
      return () => clearTimeout(t);
    }
  }, [pathname, unreadCount]);

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#1f2023] text-white">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (isSalonContext) {
    return <>{children}</>;
  }

  const tabs: BottomTab[] = [
    { key: 'home', href: '/telegram/m/home', icon: Home, label: 'Сегодня' },
    { key: 'calendar', href: '/telegram/m/calendar', icon: Calendar, label: 'Календарь' },
    { key: 'clients', href: '/telegram/m/clients', icon: Users, label: 'Клиенты' },
    { key: 'finance', href: '/telegram/m/stats', icon: TrendingUp, label: 'Финансы' },
    { key: 'profile', href: '/telegram/m/profile', icon: User, label: 'Профиль' },
  ];

  const hideHeader = pathname === '/telegram/m/voice-intro' || pathname.startsWith('/telegram/m/salon/');

  return (
    <TelegramProvider>
      <div className="flex h-dvh flex-col bg-[#1f2023] text-white">
        {!hideHeader && (
          <header
            className="absolute right-3 z-20 flex items-center"
            style={{ top: 'calc(var(--tg-content-top, 8px) + 8px)' }}
          >
            <Link
              href="/telegram/m/notifications"
              aria-label="Уведомления"
              className="relative flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] active:bg-white/[0.08] transition-colors"
            >
              <Bell className="size-5 text-white/80" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-[10px] font-semibold flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </header>
        )}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            paddingTop: 'var(--tg-content-top, 0px)',
            paddingBottom: 'calc(72px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {children}
        </main>
        <BottomTabs tabs={tabs} />
      </div>
    </TelegramProvider>
  );
}
