/** --- YAML
 * name: TelegramMiniAppLayout
 * description: Premium Mini App shell — Fresha-style. Светлый фон, floating-pill bottom
 *              nav (4 таба: Главная / Поиск / Записи / Профиль). Дизайн-токены из
 *              `@/components/miniapp/design`. На /telegram/book вкладки скрыты.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, CalendarDays, User } from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { MiniAppBottomNav, type NavTab } from '@/components/miniapp/bottom-nav';
import { MiniAppThemeProvider } from '@/components/miniapp/theme';
import { PageTransition } from '@/components/miniapp/page-transition';
import { T, FONT_BASE } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import type { UserRole, SubscriptionTier } from '@/types';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { useSyncLocaleFromDb } from '@/lib/miniapp/use-sync-locale';

const NAV_LABELS: Record<'uk' | 'ru' | 'en', readonly [string, string, string, string]> = {
  uk: ['Головна', 'Пошук', 'Записи', 'Профіль'],
  ru: ['Главная', 'Поиск', 'Записи', 'Профиль'],
  en: ['Home', 'Search', 'Activity', 'Profile'],
};

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [hydrated, setHydrated] = useState(false);
  // Тянем сохранённый язык из БД при первом открытии — переживает сессии.
  useSyncLocaleFromDb();
  const lang = useMiniAppLocale();
  const [home, search, activity, profile] = NAV_LABELS[lang];

  // На hard reload zustand-стор пуст. Пробуем поднять Supabase session
  // (для browser users) перед редиректом на /telegram. Так избегаем мигания
  // и лишнего hop'а в init-page для уже залогиненных через cookie.
  useEffect(() => {
    if (userId) { setHydrated(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          // tier лежит на subscriptions, не на profiles — раньше выбирали
          // 'tier' прямо отсюда и получали 400. Сейчас читаем только profile,
          // tier подтянем отдельно (для UI он нужен только в master shell).
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .maybeSingle<{ role: string | null; full_name: string | null }>();
          if (cancelled) return;
          setAuth(user.id, (profile?.role ?? 'client') as UserRole, null as SubscriptionTier | null, profile?.full_name ?? null);
          setHydrated(true);
          return;
        }
      } catch { /* ignore */ }
      if (!cancelled) router.replace('/telegram');
    })();
    return () => { cancelled = true; };
  }, [userId, router, setAuth]);

  // Не рендерим контент пока не убедились в auth — иначе подкомпоненты
  // делают запросы с null userId и получают пустоту.
  if (!userId && !hydrated) {
    return null;
  }

  // Fullscreen routes — booking flow has its own sticky footer.
  const isFullscreen = pathname.startsWith('/telegram/book');

  return (
    <TelegramProvider>
      <MiniAppThemeProvider
        className="miniapp-scope"
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
            // Bottom nav — это floating pill (bottom: 12px + ~64px высота).
            // Раньше padding был 96px — последний ряд карточек залезал под
            // nav, юзер не видел нижнюю часть «Топ категории». Бампаем до
            // 128px чтобы был видимый воздух между последним блоком и nav.
            paddingBottom: isFullscreen
              ? 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))'
              : 'calc(81px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
          }}
        >
          <PageTransition>{children}</PageTransition>
        </main>
        <MiniAppBottomNav
          tabs={[
            { key: 'home', href: '/telegram/home', icon: Home, label: home },
            { key: 'search', href: '/telegram/search', icon: Search, label: search },
            { key: 'activity', href: '/telegram/activity', icon: CalendarDays, label: activity },
            { key: 'profile', href: '/telegram/profile', icon: User, label: profile },
          ] satisfies readonly NavTab[]}
          hidden={isFullscreen}
        />
      </MiniAppThemeProvider>
    </TelegramProvider>
  );
}
