/** --- YAML
 * name: TelegramMasterMiniAppLayout
 * description: Master Mini App shell — dark theme, 4-tab bottom bar (Home, Calendar, Clients, Profile). Mirrors client shell but auth-gates by master row existence.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Calendar, Users, User, Bell, Loader2 } from 'lucide-react';
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
    {
      key: 'notifications',
      href: '/telegram/m/notifications',
      icon: Bell,
      label: 'Уведомления',
      badge: unreadCount,
    },
    { key: 'profile', href: '/telegram/m/profile', icon: User, label: 'Профиль' },
  ];

  return (
    <TelegramProvider>
      <div className="flex h-dvh flex-col bg-[#1f2023] text-white">
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
