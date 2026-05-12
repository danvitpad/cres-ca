/** --- YAML
 * name: Dashboard Layout
 * description: Top header (logo + setup CTA + announcement strip + search + notifications bell). Hover-expand SessionNavBar sidebar (nav / theme + account bottom). Notifications popover anchored to header bell.
 * updated: 2026-04-18
 * --- */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence } from 'framer-motion';
import {
  FreshaHome,
  FreshaCalendar,
  FreshaWallet,
  FreshaPerson,
  FreshaBook,
  FreshaMegaphone,
  FreshaAddons,
  FreshaHelp,
  FreshaSearch,
  FreshaBell,
} from '@/components/shared/fresha-icons';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { CommandPalette, useCommandPalette } from '@/components/shared/primitives/command-palette';
import { OnboardingDialog } from '@/components/shared/onboarding-dialog';
import { WelcomeGate } from '@/components/shared/welcome-gate';
import { TourOverlay } from '@/components/shared/tour-overlay';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ConfirmProvider, useConfirm } from '@/hooks/use-confirm';
import { UserCircle, Settings as SettingsIcon, LogOut, Moon, Sun, BarChart3 } from 'lucide-react';
import { RouteFeatureGate } from '@/components/subscription/route-feature-gate';
import { TrialBadge } from '@/components/subscription/trial-badge';
import { DashboardRealtimeToasts } from '@/components/dashboard/dashboard-realtime-toasts';
import { InactivityLogout } from '@/components/auth/inactivity-logout';
import { ReminderPopup } from '@/components/reminders/reminder-popup';
import { PageHelpButton } from '@/components/shared/page-help-button';
import { F_LIGHT, F_DARK, type FTheme } from '@/lib/dashboard-theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useAnnouncements } from '@/hooks/use-announcements';
import { HeaderNotificationsDropdown } from '@/components/dashboard/header-notifications-dropdown';
import { HeaderAnnouncementStrip } from '@/components/dashboard/header-announcement-strip';
import { HeaderAiAssistant } from '@/components/dashboard/header-ai-assistant';
// PublicPageDropdown header chip retired — public page is reachable via «Мой профиль» in user menu.
// Component file kept for now in case we want to re-introduce it as a separate widget.
import { SessionNavBar, type SidebarNavItem } from '@/components/ui/sidebar';
import { useUiPrefs } from '@/hooks/use-ui-prefs';

/* ─── Layout constants (header) ─── */
const S = {
  headerH: 65,
  headerPadding: '8px 32px 8px 16px',
  iconBtnSize: 44,
  iconBtnRadius: 8,
  iconSize: 24,
} as const;

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

/**
 * SessionNavBar wrapper, который живёт ВНУТРИ ConfirmProvider — чтобы можно было
 * звать useConfirm() в onClick «Выход» (правило CLAUDE.md: useConfirm вместо
 * window.confirm). Сам DashboardLayout — родитель провайдера, поэтому хук там
 * вызвать нельзя.
 */
function DashboardSidebar({
  navItems, bottomItems, isDark, setTheme, persistTheme,
  masterName, master, signOutLabel,
}: {
  navItems: SidebarNavItem[];
  bottomItems: SidebarNavItem[];
  isDark: boolean;
  setTheme: (t: string) => void;
  persistTheme: (t: 'light' | 'dark') => void;
  masterName: string;
  master: { slug?: string | null; profile?: { avatar_url?: string | null } | null } | null;
  signOutLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  return (
    <SessionNavBar
      navItems={navItems}
      bottomItems={bottomItems}
      themeToggle={{
        isDark,
        onToggle: () => {
          const next = isDark ? 'light' : 'dark';
          setTheme(next);
          persistTheme(next);
        },
        lightIcon: Sun,
        darkIcon: Moon,
        label: 'Тема',
      }}
      account={{
        name: masterName,
        initials: getInitials(masterName),
        avatarUrl: master?.profile?.avatar_url || null,
        menuItems: [
          {
            icon: UserCircle,
            label: 'Мой профиль',
            href: master?.slug ? `/m/${master.slug}` : '/settings?section=profile',
          },
          { icon: SettingsIcon, label: 'Настройки', href: '/settings' },
          {
            icon: LogOut,
            label: signOutLabel,
            destructive: true,
            onClick: async () => {
              const ok = await confirm({
                title: 'Точно выйти?',
                confirmLabel: 'Выйти',
                destructive: true,
              });
              if (!ok) return;
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push('/login');
            },
          },
        ],
      }}
    />
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const { master } = useMaster();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  // Синхронизированные настройки (тема + язык интерфейса) — единый источник правды
  // в profiles. На load подтягиваем + применяем; setTheme внутри useUiPrefs пишет
  // в БД, чтобы Mini App увидел тот же выбор после reconnect'а.
  const { updateTheme: persistTheme } = useUiPrefs();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  const F: FTheme = isDark ? F_DARK : F_LIGHT;
  const masterName = master?.profile?.first_name || master?.profile?.full_name || '';

  const userId = master?.profile_id ?? null;
  const { items: notifItems, unreadCount, loading: notifLoading, followStates, markRead, markAllRead, dismiss: dismissNotif, dismissAll: dismissAllNotifs, toggleFollow } = useNotifications(userId);
  const { announcements, dismiss: dismissAnnouncement } = useAnnouncements();

  // Проверяем — мастер сам владелец салона? Если да, перестраиваем сайдбар
  // под админ-флоу: разделы ведут на /salon/{id}/..., добавляется «Команда».
  const [ownedSalonId, setOwnedSalonId] = useState<string | null>(null);
  // Если мастер — член команды в unified-режиме, скрываем разделы которыми
  // владеет админ (склад, финансы, клиенты, каталог-edit).
  const [unifiedTeamLimited, setUnifiedTeamLimited] = useState(false);
  useEffect(() => {
    if (!userId) { setOwnedSalonId(null); setUnifiedTeamLimited(false); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: owned } = await supabase
        .from('salons')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setOwnedSalonId(owned?.id ?? null);
      if (owned?.id) return; // owner не ограничен

      // Team-mode (unified) проверка временно отключена — релизим только соло.
      // Раньше делали embed `salon:salons(team_mode)` но он 400 при RLS на salons
      // для не-owner участников. Возвращать когда команды снова включим.
      if (!cancelled) setUnifiedTeamLimited(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const navItems: SidebarNavItem[] = useMemo(() => {
    // Команда временно отключена — релизим только соло мастера.
    // Все ветки sidebar'а сведены к одной соло-конфигурации.
    void ownedSalonId; void unifiedTeamLimited; // оставляем стейт для future re-enable
    return [
      { key: 'today', icon: FreshaHome, href: '/today', label: t('nav.dashboard') },
      { key: 'calendar', icon: FreshaCalendar, href: '/calendar', label: t('nav.calendar') },
      { key: 'finance', icon: FreshaWallet, href: '/finance', label: t('nav.finance') },
      { key: 'contacts', icon: FreshaPerson, href: '/clients', label: t('nav.contacts') },
      { key: 'catalogue', icon: FreshaBook, href: '/services', label: t('nav.catalogue') },
      { key: 'marketing', icon: FreshaMegaphone, href: '/marketing', label: t('nav.messaging') },
      { key: 'partners', icon: FreshaPerson, href: '/partners', label: 'Партнёры' },
      { key: 'stats', icon: BarChart3, href: '/stats', label: 'Статистика' },
    ];
  }, [t, ownedSalonId, unifiedTeamLimited]);

  const bottomItems: SidebarNavItem[] = useMemo(
    () => [
      { key: 'help', icon: FreshaHelp, href: '/help', label: 'Помощь' },
    ],
    [],
  );

  return (
    <ConfirmProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        {/* ═══ Top header — logo + setup CTA + announcement strip + search ═══ */}
        <header
          style={{
            height: S.headerH,
            padding: S.headerPadding,
            backgroundColor: F.headerBg,
            borderBottom: `0.8px solid ${F.headerBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {/* Left: logo + setup CTA + trial */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <Link href="/calendar" style={{ display: 'block', height: 22 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: F.textPrimary,
                  letterSpacing: '-0.02em',
                  lineHeight: '22px',
                }}
              >
                CRES-CA
              </span>
            </Link>
            {/* «Продолжить настройку» CTA убран — мастер заполняет всё на регистрации. */}
            {/* PublicPageDropdown убран — профиль и публичная страница теперь одно и то же,
                переход живёт в юзер-меню («Мой профиль»). */}
            <TrialBadge />
          </div>

          {/* Center: AI-помощник + announcement strip */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, gap: 12 }}>
            <HeaderAiAssistant theme={F} isDark={isDark} />
            <HeaderAnnouncementStrip
              announcements={announcements}
              dismiss={dismissAnnouncement}
              theme={F}
              isDark={isDark}
            />
          </div>

          {/* Right: language + search + notifications bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            {/* Language picker — выбор интерфейсного языка (ru/uk/en). Раньше веб
                не имел видимой кнопки переключения, locale читался только из cookie. */}
            <LanguageSwitcher />
            <button
              onClick={() => setCmdOpen(true)}
              style={{
                width: S.iconBtnSize,
                height: S.iconBtnSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: S.iconBtnRadius,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: F.textPrimary,
                transition: 'background-color 100ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = F.hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              aria-label={t('search')}
            >
              <FreshaSearch style={{ width: S.iconSize, height: S.iconSize }} />
            </button>

            {/* Notifications bell with downward popover */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotificationsOpen((v) => !v)}
                style={{
                  width: S.iconBtnSize,
                  height: S.iconBtnSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: S.iconBtnRadius,
                  backgroundColor: notificationsOpen ? F.hoverBg : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: F.textPrimary,
                  position: 'relative',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = F.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = notificationsOpen ? F.hoverBg : 'transparent'; }}
                aria-label={t('notificationsLabel')}
              >
                <FreshaBell style={{ width: S.iconSize, height: S.iconSize }} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <HeaderNotificationsDropdown
                    open={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                    items={notifItems}
                    unreadCount={unreadCount}
                    loading={notifLoading}
                    followStates={followStates}
                    markRead={markRead}
                    markAllRead={markAllRead}
                    dismiss={dismissNotif}
                    dismissAll={dismissAllNotifs}
                    toggleFollow={toggleFollow}
                    theme={F}
                    isDark={isDark}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ═══ Below header: sidebar + content ═══ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* ═══ Hover-expand sidebar (3rem → 15rem) ═══ */}
          <DashboardSidebar
            navItems={navItems}
            bottomItems={bottomItems}
            isDark={isDark}
            setTheme={setTheme}
            persistTheme={persistTheme}
            masterName={masterName}
            master={master ?? null}
            signOutLabel={t('header.signOut') || 'Выход'}
          />

          {/* ═══ Content area ═══ */}
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              backgroundColor: F.contentBg,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <RouteFeatureGate>{children}</RouteFeatureGate>
            </div>
          </main>
        </div>

        <WelcomeGate />
        <TourOverlay />
      <OnboardingDialog />
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
        <DashboardRealtimeToasts />
        <InactivityLogout />
        <ReminderPopup />
        <PageHelpButton />
      </div>
    </ConfirmProvider>
  );
}
