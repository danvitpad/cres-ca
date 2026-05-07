/** --- YAML
 * name: TelegramMasterMiniAppLayout
 * description: Master Mini App shell — Fresha-premium light theme. Floating-pill
 *              bottom nav 5 табов: Календарь · Клиенты · Услуги · Финансы · Ещё.
 *              Уведомлений как таба нет — приходят в TG-бот. Профиль открывается
 *              по тапу на кружок аватара справа сверху (HeaderAvatar).
 * created: 2026-04-13
 * updated: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarDays,
  Users as UsersIcon,
  Scissors,
  TrendingUp,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { MiniAppBottomNav, type NavTab } from '@/components/miniapp/bottom-nav';
import { MiniAppThemeProvider } from '@/components/miniapp/theme';
import { MiniAppHeaderAvatar } from '@/components/miniapp/header-avatar';
import { T, FONT_BASE } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';

export default function MasterMiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [checking, setChecking] = useState(true);

  const isSalonContext = pathname.startsWith('/telegram/m/salon/');

  useEffect(() => {
    if (isSalonContext) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      let resolvedUserId = userId;
      if (!resolvedUserId) {
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
        resolvedUserId = user.id;
      }
      const { data } = await supabase.from('masters').select('id').eq('profile_id', resolvedUserId).maybeSingle();
      if (cancelled) return;
      void data;
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
    { key: 'calendar', href: '/telegram/m/calendar', icon: CalendarDays, label: 'Календарь' },
    { key: 'clients', href: '/telegram/m/clients', icon: UsersIcon, label: 'Клиенты' },
    { key: 'services', href: '/telegram/m/services', icon: Scissors, label: 'Услуги' },
    { key: 'finance', href: '/telegram/m/finance', icon: TrendingUp, label: 'Финансы' },
    { key: 'more', href: '/telegram/m/more', icon: MoreHorizontal, label: 'Ещё' },
  ];

  // Fullscreen routes — booking/voice flows have own footers; profile = свой UI без табов.
  const isFullscreen =
    pathname.startsWith('/telegram/m/voice-book') ||
    pathname.startsWith('/telegram/m/voice-intro') ||
    pathname.startsWith('/telegram/m/slot/') ||
    pathname.startsWith('/telegram/m/onboarding') ||
    pathname === '/telegram/m/profile';

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
          {children}
        </main>
        {!isFullscreen && <MiniAppHeaderAvatar />}
        {!isFullscreen && <MiniAppBottomNav tabs={tabs} />}
      </MiniAppThemeProvider>
    </TelegramProvider>
  );
}
