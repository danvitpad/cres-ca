/** --- YAML
 * name: TelegramMiniAppLayout
 * description: Mini App shell — fixed top safe-area, scrollable content, bottom tab bar with 5 sections (Home / Search / Activity / Notifications / Profile). Provides Telegram WebApp context and realtime unread-notifications badge.
 * created: 2026-04-13
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Clock, User, Bell } from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

function getInitData(): string | null {
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
}

const tabs = [
  { key: 'home', href: '/telegram/home', icon: Home, label: 'Главная' },
  { key: 'search', href: '/telegram/map', icon: Search, label: 'Поиск' },
  { key: 'activity', href: '/telegram/activity', icon: Clock, label: 'Записи' },
  { key: 'notifications', href: '/telegram/notifications', icon: Bell, label: 'Уведомления' },
  { key: 'profile', href: '/telegram/profile', icon: User, label: 'Профиль' },
] as const;

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      router.replace('/telegram');
    }
  }, [userId, router]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const fetchCount = async () => {
      const initData = getInitData();
      if (!initData) return;
      const res = await fetch('/api/telegram/c/notifications', {
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
    if (pathname === '/telegram/notifications' && unreadCount > 0) {
      const t = setTimeout(() => setUnreadCount(0), 1500);
      return () => clearTimeout(t);
    }
  }, [pathname, unreadCount]);

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
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1f2023]/95 backdrop-blur-xl"
          style={{
            paddingBottom: 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))',
          }}
        >
          <ul className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-2">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              const Icon = tab.icon;
              const showBadge = tab.key === 'notifications' && unreadCount > 0;
              return (
                <li key={tab.key} className="flex-1">
                  <Link
                    href={tab.href}
                    aria-label={tab.label}
                    className={cn(
                      'relative flex items-center justify-center rounded-2xl px-1 py-3 transition-colors',
                      active ? 'text-violet-300' : 'text-white/40 hover:text-white/70',
                    )}
                  >
                    <div className="relative">
                      <Icon
                        className={cn('size-[26px] transition-transform', active && 'scale-110')}
                        strokeWidth={active ? 2.5 : 2}
                      />
                      {showBadge && (
                        <span className="absolute -right-1.5 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    {active && (
                      <span className="absolute -top-[9px] left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-violet-400" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </TelegramProvider>
  );
}
