/** --- YAML
 * name: TelegramMiniAppLayout
 * description: Premium Mini App shell — Fresha-style. Светлый фон, floating-pill bottom
 *              nav (4 таба: Главная / Поиск / Записи / Профиль). Дизайн-токены из
 *              `@/components/miniapp/design`. На /telegram/book вкладки скрыты.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, CalendarDays, User } from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { MiniAppBottomNav, type NavTab } from '@/components/miniapp/bottom-nav';
import { T, FONT_BASE } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';

const tabs: readonly NavTab[] = [
  { key: 'home', href: '/telegram/home', icon: Home, label: 'Главная' },
  { key: 'search', href: '/telegram/search', icon: Search, label: 'Поиск' },
  { key: 'activity', href: '/telegram/activity', icon: CalendarDays, label: 'Записи' },
  { key: 'profile', href: '/telegram/profile', icon: User, label: 'Профиль' },
];

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!userId) {
      router.replace('/telegram');
    }
  }, [userId, router]);

  // Fullscreen routes — booking flow has its own sticky footer.
  const isFullscreen = pathname.startsWith('/telegram/book');

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
        <MiniAppBottomNav tabs={tabs} hidden={isFullscreen} />
      </div>
    </TelegramProvider>
  );
}
