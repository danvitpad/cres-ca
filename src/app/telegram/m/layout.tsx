/** --- YAML
 * name: TelegramMasterMiniAppLayout
 * description: Master Mini App shell — Fresha-premium light theme. Floating-pill
 *              bottom nav 4 таба: Главная · Календарь · Финансы · Ещё.
 *              Клиенты и Услуги переехали в Ещё. Уведомления приходят в TG-бот.
 *              Профиль открывается по тапу на кружок аватара справа сверху.
 * created: 2026-04-13
 * updated: 2026-05-11
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home as HomeIcon,
  CalendarDays,
  Coins,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { MiniAppBottomNav, type NavTab } from '@/components/miniapp/bottom-nav';
import { MiniAppThemeProvider } from '@/components/miniapp/theme';
import { MiniAppHeaderAvatar } from '@/components/miniapp/header-avatar';
import { PageTransition } from '@/components/miniapp/page-transition';
import { T, FONT_BASE } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useSyncLocaleFromDb } from '@/lib/miniapp/use-sync-locale';

export default function MasterMiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  // Синхронизация языка из БД при первом открытии — нужно чтобы выбранный
  // язык сохранялся между сессиями и устройствами.
  useSyncLocaleFromDb();
  // Если userId уже поднят из zustand store — пропускаем initial-checking фазу,
  // чтобы спиннер не моргал на frame перед рендером скелетов и контента.
  const [checking, setChecking] = useState(() => !useAuthStore.getState().userId);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const isSalonContext = pathname.startsWith('/telegram/m/salon/');

  // При открытой экранной клавиатуре прячем bottom-nav и кружок аватара —
  // иначе они перекрывают нижние поля формы (ввод дохода/расхода, заметки
  // в карточке клиента и т.п.). Когда клавиатура закрывается, элементы
  // возвращаются автоматически.
  // (Покраска html/body под цвет темы переехала в MiniAppThemeProvider —
  // она читает резолвнутую тему напрямую вместо --m-bg CSS-переменной,
  // которая на :root не наследовалась с data-theme div'а.)

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const baseHeight = window.innerHeight;
    function update() {
      // Эвристика: если visual viewport короче окна больше чем на 150px —
      // значит клавиатура съела место. Порог 150px защищает от false-positive
      // на iOS, где safari address bar тоже немного двигает viewport.
      const open = baseHeight - vv!.height > 150;
      setKeyboardOpen(open);
    }
    vv.addEventListener('resize', update);
    update();
    return () => vv.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (isSalonContext) {
      setChecking(false);
      return;
    }
    // Guard: если userId уже в zustand-сторе — не делаем повторный auth bootstrap.
    // Иначе useEffect перезапускался по [userId] после setAuth и грузил masters
    // дважды (видно в Network tab — два одинаковых REST-запроса). Второй запрос
    // masters вообще не нужен — результат был void.
    if (userId) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { router.replace('/telegram'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle<{ role: string | null; full_name: string | null }>();
      if (cancelled) return;
      const role = (profile?.role ?? 'client') as 'master' | 'client' | 'salon_admin' | 'receptionist';
      useAuthStore.getState().setAuth(user.id, role, null, profile?.full_name ?? null);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [userId, router, isSalonContext]);

  if (checking) {
    return (
      <MiniAppThemeProvider
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
      </MiniAppThemeProvider>
    );
  }

  if (isSalonContext) {
    return <>{children}</>;
  }

  const tabs: readonly NavTab[] = [
    { key: 'home', href: '/telegram/m/home', icon: HomeIcon, label: 'Главная' },
    { key: 'calendar', href: '/telegram/m/calendar', icon: CalendarDays, label: 'Календарь' },
    { key: 'finance', href: '/telegram/m/finance', icon: Coins, label: 'Финансы' },
    { key: 'more', href: '/telegram/m/more', icon: MoreHorizontal, label: 'Ещё' },
  ];

  // Fullscreen routes — booking/voice flows have own footers; profile/public-page
  // = свой UI с крестиком закрытия, без bottom-nav.
  const isFullscreen =
    pathname.startsWith('/telegram/m/voice-book') ||
    pathname.startsWith('/telegram/m/voice-intro') ||
    pathname.startsWith('/telegram/m/slot/') ||
    pathname.startsWith('/telegram/m/onboarding') ||
    pathname === '/telegram/m/profile' ||
    pathname === '/telegram/m/public-page';

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
            paddingBottom: isFullscreen
              ? 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))'
              : 'calc(81px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
          }}
        >
          <PageTransition>{children}</PageTransition>
        </main>
        {!isFullscreen && !keyboardOpen && <MiniAppHeaderAvatar />}
        {!isFullscreen && !keyboardOpen && <MiniAppBottomNav tabs={tabs} />}
      </MiniAppThemeProvider>
    </TelegramProvider>
  );
}
