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
  FreshaTag,
  FreshaSmile,
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
import { ConfirmProvider } from '@/hooks/use-confirm';
import { UserCircle, Settings as SettingsIcon, LogOut, Moon, Sun } from 'lucide-react';
import { RouteFeatureGate } from '@/components/subscription/route-feature-gate';
import { TrialBadge } from '@/components/subscription/trial-badge';
import { DashboardRealtimeToasts } from '@/components/dashboard/dashboard-realtime-toasts';
import { ReminderPopup } from '@/components/reminders/reminder-popup';
import { F_LIGHT, F_DARK, type FTheme } from '@/lib/dashboard-theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useAnnouncements } from '@/hooks/use-announcements';
import { HeaderNotificationsDropdown } from '@/components/dashboard/header-notifications-dropdown';
import { HeaderAnnouncementStrip } from '@/components/dashboard/header-announcement-strip';
import { SessionNavBar, type SidebarNavItem } from '@/components/ui/sidebar';

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { master } = useMaster();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  const F: FTheme = isDark ? F_DARK : F_LIGHT;
  const masterName = master?.profile?.first_name || master?.profile?.full_name || '';

  const userId = master?.profile_id ?? null;
  const { items: notifItems, unreadCount, loading: notifLoading, followStates, markRead, markAllRead, dismiss: dismissNotif, dismissAll: dismissAllNotifs, toggleFollow } = useNotifications(userId);
  const { announcements, dismiss: dismissAnnouncement } = useAnnouncements();

  const navItems: SidebarNavItem[] = useMemo(
    () => [
      { key: 'today', icon: FreshaHome, href: '/today', label: t('nav.dashboard') },
      { key: 'calendar', icon: FreshaCalendar, href: '/calendar', label: t('nav.calendar') },
      { key: 'sales', icon: FreshaTag, href: '/finance', label: t('nav.sales') },
      { key: 'clients', icon: FreshaSmile, href: '/clients', label: t('nav.clients') },
      { key: 'catalogue', icon: FreshaBook, href: '/services', label: t('nav.catalogue') },
      { key: 'marketing', icon: FreshaMegaphone, href: '/marketing', label: t('nav.messaging') },
      { key: 'integrations', icon: FreshaAddons, href: '/integrations', label: t('nav.integrations') },
    ],
    [t],
  );

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
            <button
              type="button"
              onClick={() => router.push('/settings')}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                border: 'none',
                background: 'linear-gradient(135deg, #6950f3 0%, #8b6cf7 100%)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {t('header.continueSetup')}
            </button>
            <TrialBadge />
          </div>

          {/* Center: announcement strip */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
            <HeaderAnnouncementStrip
              announcements={announcements}
              dismiss={dismissAnnouncement}
              theme={F}
              isDark={isDark}
            />
          </div>

          {/* Right: search + notifications bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
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
          <SessionNavBar
            navItems={navItems}
            bottomItems={bottomItems}
            themeToggle={{
              isDark,
              onToggle: () => setTheme(isDark ? 'light' : 'dark'),
              lightIcon: Sun,
              darkIcon: Moon,
              label: 'Тема',
            }}
            account={{
              name: masterName,
              initials: getInitials(masterName),
              avatarUrl: master?.profile?.avatar_url || null,
              menuItems: [
                { icon: UserCircle, label: 'Мой профиль', href: '/settings?section=profile' },
                { icon: SettingsIcon, label: 'Настройки', href: '/settings' },
                {
                  icon: LogOut,
                  label: t('header.signOut') || 'Выход',
                  destructive: true,
                  onClick: async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    router.push('/login');
                  },
                },
              ],
            }}
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

        <OnboardingDialog />
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
        <DashboardRealtimeToasts />
        <ReminderPopup />
      </div>
    </ConfirmProvider>
  );
}
