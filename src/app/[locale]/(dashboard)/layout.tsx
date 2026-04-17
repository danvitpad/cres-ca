/** --- YAML
 * name: Dashboard Layout
 * description: Fresha-exact layout — white top header, 72px dark sidebar rail, white content area
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
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
import { UserProfileDropdown } from '@/components/ui/user-profile-dropdown';
import { UserCircle, Settings as SettingsIcon, HelpCircle, LogOut } from 'lucide-react';
import { RouteFeatureGate } from '@/components/subscription/route-feature-gate';
import { TrialBadge } from '@/components/subscription/trial-badge';
import { DashboardRealtimeToasts } from '@/components/dashboard/dashboard-realtime-toasts';
import { ReminderPopup } from '@/components/reminders/reminder-popup';
import { F_LIGHT, F_DARK, type FTheme } from '@/lib/dashboard-theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useAnnouncements } from '@/hooks/use-announcements';
import { HeaderNotificationsDropdown } from '@/components/dashboard/header-notifications-dropdown';
import { HeaderAnnouncementStrip } from '@/components/dashboard/header-announcement-strip';

/* ─── Layout constants (shared) ─── */
const S = {
  headerH: 65,
  headerPadding: '8px 32px 8px 16px',
  sidebarW: 72,
  sidebarItemH: 52,
  sidebarItemPadY: 4,
  sidebarIconSize: 28,
  iconBtnSize: 44,
  iconBtnRadius: 8,
  iconSize: 24,
  avatarSize: 48,
  fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

/* Theme palettes imported from @/lib/dashboard-theme */

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

/* Sidebar navigation items — exact Fresha order with flyout submenus
   Direct links: dashboard, calendar, reports, add-ons, setup
   Flyout menus: clients, catalogue, sales, online-booking, marketing, team */
type SidebarNavItem = {
  key: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  href?: string;
  title?: string;
  tooltip?: string;
  submenu?: { label: string; href: string }[];
};

function buildSidebarNav(t: (key: string) => string): SidebarNavItem[] {
  return [
    { key: 'dashboard', icon: FreshaHome, href: '/dashboard', tooltip: t('nav.dashboard') },
    { key: 'calendar', icon: FreshaCalendar, href: '/calendar', tooltip: t('nav.calendar') },
    { key: 'sales', icon: FreshaTag, href: '/finance', tooltip: t('nav.sales') },
    { key: 'clients', icon: FreshaSmile, href: '/clients', tooltip: t('nav.clients') },
    { key: 'catalogue', icon: FreshaBook, href: '/services', tooltip: t('nav.catalogue') },
    { key: 'marketing', icon: FreshaMegaphone, href: '/marketing', tooltip: t('nav.messaging') },
    { key: 'addons', icon: FreshaAddons, href: '/addons', tooltip: t('nav.addons') },
    // Analytics removed — duplicates /finance?tab=reports
    // Settings moved to header dropdown under profile avatar
  ];
}

const sidebarHelp: SidebarNavItem = { key: 'help', icon: FreshaHelp, href: '/contact' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  const router = useRouter();
  const { master } = useMaster();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  const F: FTheme = isDark ? F_DARK : F_LIGHT;
  const masterName = master?.profile?.first_name || master?.profile?.full_name || '';
  const sidebarNav = useMemo(() => buildSidebarNav(t), [t]);

  const userId = master?.profile_id ?? null;
  const { items: notifItems, unreadCount, loading: notifLoading, followStates, markRead, markAllRead, toggleFollow } = useNotifications(userId);
  const { announcements, dismiss: dismissAnnouncement } = useAnnouncements();

  /* Auto-open flyout when current route matches a submenu item (like Fresha) */
  useEffect(() => {
    const matchingItem = sidebarNav.find(
      item => item.submenu && item.submenu.some(sub => pathname.includes(sub.href))
    );
    if (matchingItem) {
      setOpenFlyout(matchingItem.key);
    }
  }, [pathname, sidebarNav]);

  function isActive(href: string) {
    return pathname.includes(href);
  }

  function isItemActive(item: SidebarNavItem): boolean {
    if (item.href) return isActive(item.href);
    if (item.submenu) return item.submenu.some(sub => isActive(sub.href));
    return false;
  }

  /* ═══ Sidebar icon item — Fresha: 72×52px, centered icon, active = accent pill ═══ */
  function SidebarItem({ item }: { item: SidebarNavItem }) {
    const Icon = item.icon;
    const active = isItemActive(item);
    const hasFlyout = !!item.submenu;
    const [hovered, setHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const tooltipLabel = item.tooltip || item.title || item.key;

    function handleClick(e: React.MouseEvent) {
      if (hasFlyout) {
        e.preventDefault();
        if (openFlyout === item.key) {
          setOpenFlyout(null);
        } else {
          const rect = itemRef.current?.getBoundingClientRect();
          if (rect) {
            /* Estimate flyout height: title(30) + items(40 each) + padding(16) */
            const estimatedH = (item.submenu!.length * 40) + (item.title ? 30 : 0) + 16;
            const maxTop = window.innerHeight - estimatedH - 8;
            setFlyoutTop(Math.min(rect.top, Math.max(0, maxTop)));
          }
          setOpenFlyout(item.key);
        }
      } else {
        setOpenFlyout(null);
        setMobileOpen(false);
      }
    }

    const Wrapper = item.href && !hasFlyout ? Link : 'button';
    const wrapperProps = item.href && !hasFlyout ? { href: item.href } : { type: 'button' as const };

    const itemRef = useRef<HTMLDivElement>(null);

    return (
      <div ref={itemRef} style={{ position: 'relative' }}>
        <Wrapper
          {...wrapperProps as any}
          onClick={handleClick}
          onMouseEnter={() => {
            setHovered(true);
            if (itemRef.current) {
              const rect = itemRef.current.getBoundingClientRect();
              setTooltipPos({ left: rect.right + 8, top: rect.top + rect.height / 2 });
            }
          }}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: S.sidebarW,
            height: S.sidebarItemH,
            padding: `${S.sidebarItemPadY}px 0`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 150ms',
            position: 'relative',
            border: 'none',
            backgroundColor: 'transparent',
          }}
        >
          {active && (
            <div
              style={{
                position: 'absolute',
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: F.sidebarActiveBg,
              }}
            />
          )}
          <Icon
            style={{
              width: S.sidebarIconSize,
              height: S.sidebarIconSize,
              color: active ? F.sidebarActiveIconColor : F.sidebarInactiveIconColor,
              position: 'relative',
              zIndex: 1,
            }}
          />
          {/* Tooltip — rendered via fixed position to escape aside overflow */}
        </Wrapper>

        {/* Flyout submenu — full-height panel like Fresha, fixed next to sidebar */}
        <AnimatePresence>
          {hasFlyout && openFlyout === item.key && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                left: S.sidebarW,
                top: S.headerH,
                bottom: 0,
                width: 240,
                backgroundColor: F.sidebarBg,
                borderRight: `0.8px solid ${mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#e5e5e5'}`,
                padding: '16px 0',
                zIndex: 800,
                overflowY: 'auto',
              }}
            >
              {/* Flyout header — Fresha style: title + close chevron */}
              {item.title && (
                <div style={{
                  padding: '8px 20px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: F.textPrimary,
                    lineHeight: '22px',
                  }}>
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenFlyout(null)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#e5e5e5',
                      color: F.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    ‹
                  </button>
                </div>
              )}
              {item.submenu!.map((sub) => {
                const subActive = isActive(sub.href);
                return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => { setMobileOpen(false); }}
                  style={{
                    display: 'block',
                    padding: '10px 20px',
                    fontSize: 15,
                    fontWeight: subActive ? 600 : 400,
                    color: F.textPrimary,
                    textDecoration: 'none',
                    borderRadius: 0,
                    transition: 'background 100ms',
                    lineHeight: '22px',
                    backgroundColor: subActive ? (mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#e8e4fd') : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!subActive) e.currentTarget.style.backgroundColor = mounted && resolvedTheme === 'dark' ? '#0a0a0a' : '#f5f5f5'; }}
                  onMouseLeave={(e) => { if (!subActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {sub.label}
                </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tooltip — fixed position to escape aside overflow */}
        {hovered && openFlyout !== item.key && tooltipPos && (
          <div
            style={{
              position: 'fixed',
              left: tooltipPos.left,
              top: tooltipPos.top,
              transform: 'translateY(-50%)',
              zIndex: 1000,
              backgroundColor: mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#0d0d0d',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {tooltipLabel}
          </div>
        )}
      </div>
    );
  }

  return (
    <ConfirmProvider>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* ═══ Top header bar — Fresha: full width, 65px, white, border-bottom ═══ */}
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
        {/* Left: logo + setup CTA */}
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
          {/* "Продолжить настройку" — Fresha setup CTA pill button */}
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

        {/* Right: icon buttons + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
          {/* Search — 44×44, borderRadius 8 */}
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
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = F.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label={t('search')}
          >
            <FreshaSearch style={{ width: S.iconSize, height: S.iconSize }} />
          </button>

          {/* Bell with badge — 44×44, red badge + live notifications panel */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
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
                position: 'relative',
                transition: 'background-color 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = F.hoverBg; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              aria-label={t('notificationsLabel')}
            >
              <FreshaBell style={{ width: S.iconSize, height: S.iconSize }} />
              {unreadCount > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 12,
                    height: 20,
                    padding: '0 4px',
                    borderRadius: 999,
                    backgroundColor: F.badgeBg,
                    color: F.badgeText,
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 0 2px ${F.headerBg}`,
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
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
                  toggleFollow={toggleFollow}
                  theme={F}
                  isDark={isDark}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Avatar — 21st.dev UserProfileDropdown */}
          <div style={{ paddingLeft: 8 }}>
            <UserProfileDropdown
              user={{
                name: masterName,
                handle: master?.profile?.full_name || '',
                avatarUrl: master?.profile?.avatar_url || null,
              }}
              menuItems={[
                { icon: UserCircle,     label: 'Мой профиль',        onClick: () => router.push('/settings?section=profile') },
                { icon: SettingsIcon,   label: 'Настройки',           onClick: () => router.push('/settings') },
                { icon: HelpCircle,     label: 'Помощь и поддержка',  onClick: () => router.push('/help') },
                {
                  icon: LogOut,
                  label: t('header.signOut') || 'Выход',
                  isDestructive: true,
                  onClick: async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    router.push('/login');
                  },
                },
              ]}
            >
              <button
                type="button"
                style={{
                  width: S.avatarSize,
                  height: S.avatarSize,
                  borderRadius: 999,
                  backgroundColor: F.avatarBg,
                  border: `0.8px solid ${F.avatarBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                aria-label={t('userMenu')}
              >
                {master?.profile?.avatar_url ? (
                  <img
                    src={master.profile.avatar_url}
                    alt={masterName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }}
                  />
                ) : (
                  <span style={{ color: F.textPrimary, fontSize: 16, fontWeight: 600 }}>
                    {getInitials(masterName)}
                  </span>
                )}
              </button>
            </UserProfileDropdown>
          </div>
        </div>
      </header>

      {/* ═══ Below header: sidebar + content ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ═══ Left sidebar rail — Fresha: 72px, dark, icon-only ═══ */}
        <aside
          className="hidden lg:flex"
          style={{
            width: S.sidebarW,
            flexShrink: 0,
            flexDirection: 'column',
            backgroundColor: F.sidebarBg,
            borderRight: `0.8px solid ${F.sidebarBorder}`,
            padding: '8px 0',
            zIndex: 725,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Main nav items */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {sidebarNav.map((item) => (
              <SidebarItem key={item.key} item={item} />
            ))}
          </div>
          {/* Help button at bottom */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SidebarItem item={sidebarHelp} />
          </div>
        </aside>

        {/* No backdrop div — flyout closed via onClick on main */}

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -S.sidebarW }}
                animate={{ x: 0 }}
                exit={{ x: -S.sidebarW }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="fixed inset-y-0 left-0 z-50 lg:hidden"
                style={{
                  width: S.sidebarW,
                  backgroundColor: F.sidebarBg,
                  borderRight: `0.8px solid ${F.sidebarBorder}`,
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {sidebarNav.map((item) => (
                    <SidebarItem key={item.key} item={item} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <SidebarItem item={sidebarHelp} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ═══ Content area — shifts right when flyout submenu is open ═══ */}
        <main
          onClick={() => { if (openFlyout) setOpenFlyout(null); }}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            backgroundColor: F.contentBg,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            marginLeft: openFlyout ? 240 : 0,
            transition: 'margin-left 0.15s ease',
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
