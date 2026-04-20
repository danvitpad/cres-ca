/** --- YAML
 * name: TelegramMiniAppLayout
 * description: Mini App shell — fixed top safe-area, scrollable content, bottom tab bar with 5 sections (Home / Search / Appointments / Bonuses / Profile). Provides Telegram WebApp context. Notifications accessible via Profile menu.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, CalendarDays, Sparkles, User } from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'home', href: '/telegram/home', icon: Home, label: 'Главная' },
  { key: 'search', href: '/telegram/search', icon: Search, label: 'Поиск' },
  { key: 'activity', href: '/telegram/activity', icon: CalendarDays, label: 'Записи' },
  { key: 'bonuses', href: '/telegram/bonuses', icon: Sparkles, label: 'Бонусы' },
  { key: 'profile', href: '/telegram/profile', icon: User, label: 'Профиль' },
] as const;

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!userId) {
      router.replace('/telegram');
    }
  }, [userId, router]);

  return (
    <TelegramProvider>
      <div className="flex h-dvh flex-col bg-[#0b0d17] text-white">
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
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0d17]/95 backdrop-blur-xl"
          style={{
            paddingBottom: 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))',
          }}
        >
          <ul className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-2">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              const Icon = tab.icon;
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
                    <Icon
                      className={cn('size-[26px] transition-transform', active && 'scale-110')}
                      strokeWidth={active ? 2.5 : 2}
                    />
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
