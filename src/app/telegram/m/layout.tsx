/** --- YAML
 * name: TelegramMasterMiniAppLayout
 * description: Master Mini App shell — Fresha-premium light theme. Floating-pill
 *              bottom nav 5 табов (Home / Calendar / Clients / Notifications /
 *              Profile). Тот же `MiniAppBottomNav` что у клиента — единый
 *              дизайн-язык.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  CalendarDays,
  Users as UsersIcon,
  Bell,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { MiniAppBottomNav, type NavTab } from '@/components/miniapp/bottom-nav';
import { T, FONT_BASE } from '@/components/miniapp/design';
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
  }, [userId, isSalonContext]);

  useEffect(() => {
    if (pathname === '/telegram/m/notifications' && unreadCount > 0) {
      const t = setTimeout(() => setUnreadCount(0), 1500);
      return () => clearTimeout(t);
    }
  }, [pathname, unreadCount]);

  if (checking) {
    return (
      <div
        style={{
          ...FONT_BASE,
          minHeight: '100dvh',
          background: T.bg,
          color: T.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
      </div>
    );
  }

  if (isSalonContext) {
    return <>{children}</>;
  }

  const tabs: readonly NavTab[] = [
    { key: 'home', href: '/telegram/m/home', icon: Home, label: 'Главная' },
    { key: 'calendar', href: '/telegram/m/calendar', icon: CalendarDays, label: 'Календарь' },
    { key: 'clients', href: '/telegram/m/clients', icon: UsersIcon, label: 'Клиенты' },
    { key: 'notifications', href: '/telegram/m/notifications', icon: Bell, label: 'Уведомления' },
    { key: 'profile', href: '/telegram/m/profile', icon: UserIcon, label: 'Профиль' },
  ];

  // Fullscreen routes — booking/voice flows have own footers.
  const isFullscreen =
    pathname.startsWith('/telegram/m/voice-book') ||
    pathname.startsWith('/telegram/m/voice-intro') ||
    pathname.startsWith('/telegram/m/slot/');

  return (
    <TelegramProvider>
      <div
        style={{
          ...FONT_BASE,
          minHeight: '100dvh',
          background: T.bg,
          color: T.text,
        }}
      >
        <main
          style={{
            paddingTop: 'var(--tg-content-top, 0px)',
            paddingBottom: isFullscreen
              ? 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))'
              : 'calc(96px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {children}
        </main>
        {!isFullscreen && (
          <MiniAppBottomNav
            tabs={tabs.map((t) => (t.key === 'notifications' && unreadCount > 0 ? { ...t } : t))}
          />
        )}
        {/* Notification badge — render absolutely positioned over the nav bar */}
        {!isFullscreen && unreadCount > 0 && <NotificationBadge count={unreadCount} />}
      </div>
    </TelegramProvider>
  );
}

/** Floating badge over the Notifications icon — positioned over MiniAppBottomNav. */
function NotificationBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        position: 'fixed',
        right: 'calc(12px + (100vw - 24px) * 0.3 + 4px)', // approx 4th tab on a 5-tab equal split
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px) + 30px)',
        zIndex: 51,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        background: T.danger,
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${T.surface}`,
        pointerEvents: 'none',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
