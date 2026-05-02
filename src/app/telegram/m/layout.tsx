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
import { MiniAppThemeProvider } from '@/components/miniapp/theme';
import { T, FONT_BASE } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';

export default function MasterMiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [checking, setChecking] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unifiedTeamLimited, setUnifiedTeamLimited] = useState(false);

  const isSalonContext = pathname.startsWith('/telegram/m/salon/');

  useEffect(() => {
    if (isSalonContext) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // Hydrate auth-store из Supabase session если zustand пуст
      // (browser hard-reload, без Telegram). Иначе шлём на /telegram.
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { router.replace('/telegram'); return; }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, tier, full_name')
          .eq('id', user.id)
          .maybeSingle<{ role: string | null; tier: string | null; full_name: string | null }>();
        if (cancelled) return;
        const role = (profile?.role ?? 'client') as 'master' | 'client' | 'salon_admin' | 'receptionist';
        const tier = (profile?.tier ?? null) as 'trial' | 'starter' | 'pro' | 'business' | null;
        useAuthStore.getState().setAuth(user.id, role, tier, profile?.full_name ?? null);
        resolvedUserId = user.id;
      }
      // Раньше тут редирект на /telegram/home если в masters пусто, но
      // SELECT через browser supabase client иногда даёт null из-за RLS race
      // даже когда master row реально существует — мастер попадал на
      // клиентскую главную после логина. Доверяем routing'у /api/me/role
      // и login-странице. Если юзер реально не мастер — ему просто
      // покажется master-layout с пустыми данными (не критично, лучше
      // чем сломанная навигация).
      const { data } = await supabase.from('masters').select('id').eq('profile_id', resolvedUserId).maybeSingle();
      if (cancelled) return;
      if (!data) {
        // Не редиректим. Просто продолжаем — пользователь увидит мастерскую
        // оболочку. Если он не мастер по факту — внутренние API вернут пусто,
        // но навигация останется доступной.
        setChecking(false);
        return;
      }
      // Check unified team membership for nav restriction
      const { data: member } = await supabase
        .from('salon_members')
        .select('role, salon:salons(team_mode)')
        .eq('profile_id', resolvedUserId)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      const teamMode = (member?.salon as { team_mode?: string } | null)?.team_mode;
      setUnifiedTeamLimited(teamMode === 'unified' && member?.role === 'master');
      setChecking(false);
    })();
    return () => { cancelled = true; };
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

  // Команда временно отключена — у каждого мастера полный соло-набор табов.
  void unifiedTeamLimited;
  const tabs: readonly NavTab[] = [
    { key: 'home', href: '/telegram/m/home', icon: Home, label: 'Главная' },
    { key: 'calendar', href: '/telegram/m/calendar', icon: CalendarDays, label: 'Календарь' },
    { key: 'clients', href: '/telegram/m/clients', icon: UsersIcon, label: 'Клиенты' },
    { key: 'notifications', href: '/telegram/m/notifications', icon: Bell, label: 'Уведомления' },
    { key: 'profile', href: '/telegram/m/profile', icon: UserIcon, label: 'Профиль' },
  ];

  // Fullscreen routes — booking/voice flows have own footers; onboarding = no nav.
  const isFullscreen =
    pathname.startsWith('/telegram/m/voice-book') ||
    pathname.startsWith('/telegram/m/voice-intro') ||
    pathname.startsWith('/telegram/m/slot/') ||
    pathname.startsWith('/telegram/m/onboarding');

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
            // 81px = nav bottom (12) + nav height (~64) + 5px воздуха.
            // Раньше было 128px — слишком большой пустой отступ между
            // последним блоком и nav (юзер сказал «слишком много пустого»).
            paddingBottom: isFullscreen
              ? 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))'
              : 'calc(81px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
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
      </MiniAppThemeProvider>
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
