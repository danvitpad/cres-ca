/** --- YAML
 * name: Dashboard Layout
 * description: Fresha-exact layout — white top header, 72px dark sidebar rail, white content area
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FreshaHome,
  FreshaCalendar,
  FreshaTag,
  FreshaSmile,
  FreshaBook,
  FreshaContact,
  FreshaMegaphone,
  FreshaTeam,
  FreshaAnalytics,
  FreshaAddons,
  FreshaSettings,
  FreshaHelp,
  FreshaSearch,
  FreshaBarChart,
  FreshaBell,
} from '@/components/shared/fresha-icons';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';
import { CommandPalette, useCommandPalette } from '@/components/shared/primitives/command-palette';
import { OnboardingDialog } from '@/components/shared/onboarding-dialog';

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
  fontFamily: '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

/* ─── Fresha theme palettes ─── */
const F_LIGHT = {
  headerBg: '#ffffff',
  headerBorder: '#e5e5e5',
  sidebarBg: '#0d0d0d',
  sidebarBorder: '#e5e5e5',
  sidebarActiveBg: '#6950f3',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#f5f5f5',
  textPrimary: '#0d0d0d',
  avatarBg: '#ebf8fe',
  avatarBorder: '#ffffff',
  badgeBg: '#d4163a',
  badgeText: '#ffffff',
  contentBg: '#ffffff',
};

const F_DARK = {
  headerBg: '#0d0d0d',
  headerBorder: '#333333',
  sidebarBg: '#0d0d0d',
  sidebarBorder: '#333333',
  sidebarActiveBg: '#6950f3',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#f5f5f5',
  textPrimary: '#f5f5f5',
  avatarBg: '#1a1a1a',
  avatarBorder: '#333333',
  badgeBg: '#d4163a',
  badgeText: '#ffffff',
  contentBg: '#131313',
};

type FTheme = typeof F_LIGHT;

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

const sidebarNav: SidebarNavItem[] = [
  { key: 'dashboard', icon: FreshaHome, href: '/dashboard', tooltip: 'Главная' },
  { key: 'calendar', icon: FreshaCalendar, href: '/calendar', tooltip: 'Календарь' },
  {
    key: 'sales', icon: FreshaTag, title: 'Продажи',
    submenu: [
      { label: 'Ежедневные продажи', href: '/finance/daily' },
      { label: 'Список записей', href: '/finance/appointments' },
      { label: 'Список продаж', href: '/finance' },
      { label: 'Платежи', href: '/finance/payments' },
      { label: 'Подарочные карты', href: '/finance/gift-cards' },
      { label: 'Купленные абонементы', href: '/finance/memberships' },
    ],
  },
  {
    key: 'clients', icon: FreshaSmile, title: 'Клиенты',
    submenu: [
      { label: 'Список клиентов', href: '/clients' },
      { label: 'Сегменты клиентов', href: '/clients/segments' },
      { label: 'Лояльность клиентов', href: '/clients/loyalty' },
    ],
  },
  {
    key: 'catalogue', icon: FreshaBook, title: 'Каталог',
    submenu: [
      { label: 'Меню услуг', href: '/services' },
      { label: 'Абонементы', href: '/services/memberships' },
      { label: 'Товары', href: '/inventory' },
      { label: 'До / После', href: '/before-after' },
      { label: 'Рекомендации', href: '/recommend' },
      { label: 'Сеть мастеров', href: '/network' },
    ],
  },
  {
    key: 'online-booking', icon: FreshaContact, title: 'Онлайн-запись',
    submenu: [
      { label: 'Профиль на маркетплейсе', href: '/marketing/profile' },
      { label: 'Бронирование Google', href: '/marketing/google' },
      { label: 'Facebook & Instagram', href: '/marketing/social' },
      { label: 'Конструктор ссылок', href: '/marketing/links' },
    ],
  },
  {
    key: 'marketing', icon: FreshaMegaphone, title: 'Обмен сообщениями',
    submenu: [
      { label: 'Массовые кампании', href: '/marketing/campaigns' },
      { label: 'Автоматизация', href: '/marketing/automation' },
      { label: 'Уведомления', href: '/marketing/messages' },
      { label: 'Акции', href: '/marketing/deals' },
      { label: 'Умное ценообразование', href: '/marketing/pricing' },
      { label: 'Отзывы', href: '/marketing/reviews' },
    ],
  },
  {
    key: 'team', icon: FreshaTeam, title: 'Команда',
    submenu: [
      { label: 'Участники команды', href: '/settings/team' },
      { label: 'График смен', href: '/settings/team/shifts' },
      { label: 'Табели', href: '/settings/team/timesheets' },
      { label: 'Прогоны платежей', href: '/settings/team/payrun' },
    ],
  },
  {
    key: 'analytics', icon: FreshaAnalytics, href: '/finance/reports', tooltip: 'Аналитика',
  },
  { key: 'addons', icon: FreshaAddons, href: '/addons', tooltip: 'Дополнения' },
  { key: 'settings', icon: FreshaSettings, href: '/settings', tooltip: 'Настройки' },
];

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const F: FTheme = mounted && resolvedTheme === 'dark' ? F_DARK : F_LIGHT;
  const masterName = master?.profile?.full_name || 'Master';

  /* Auto-open flyout when current route matches a submenu item (like Fresha) */
  useEffect(() => {
    const matchingItem = sidebarNav.find(
      item => item.submenu && item.submenu.some(sub => pathname.includes(sub.href))
    );
    if (matchingItem) {
      setOpenFlyout(matchingItem.key);
    }
  }, [pathname]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
            Продолжить настройку
          </button>
        </div>

        {/* Right: icon buttons + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
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
            }}
            aria-label={t('search')}
          >
            <FreshaSearch style={{ width: S.iconSize, height: S.iconSize }} />
          </button>

          {/* Analytics — 44×44 */}
          <button
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
            }}
            aria-label={t('analyticsLabel')}
          >
            <FreshaBarChart style={{ width: S.iconSize, height: S.iconSize }} />
          </button>

          {/* Bell with badge — 44×44, red badge + notifications panel */}
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
              }}
              aria-label={t('notificationsLabel')}
            >
              <FreshaBell style={{ width: S.iconSize, height: S.iconSize }} />
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
                2
              </div>
            </button>

            {/* Notifications dropdown panel — Fresha style */}
            <AnimatePresence>
              {notificationsOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 899 }}
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute',
                      top: S.iconBtnSize + 8,
                      right: 0,
                      width: 380,
                      maxHeight: 500,
                      backgroundColor: F.contentBg,
                      borderRadius: 12,
                      border: `0.8px solid ${F.headerBorder}`,
                      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)',
                      zIndex: 900,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      padding: '16px 16px 12px',
                      borderBottom: `0.8px solid ${F.headerBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: F.textPrimary }}>
                        Уведомления
                      </span>
                      <button
                        type="button"
                        style={{
                          fontSize: 13,
                          color: '#0075a8',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Прочитать все
                      </button>
                    </div>
                    {/* Empty state */}
                    <div style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: mounted && resolvedTheme === 'dark' ? '#d4d4d4' : '#737373',
                    }}>
                      <FreshaBell style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 15, fontWeight: 500, color: F.textPrimary, marginBottom: 4 }}>
                        Нет новых уведомлений
                      </div>
                      <div style={{ fontSize: 13 }}>
                        Здесь будут отображаться уведомления о записях, сообщениях и обновлениях
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar — 48×48, light blue bg, rounded + user menu dropdown */}
          <div style={{ paddingLeft: 8, position: 'relative' }}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
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

            {/* User menu dropdown — Fresha style */}
            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 899 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute',
                      top: S.avatarSize + 8,
                      right: 0,
                      minWidth: 220,
                      backgroundColor: F.contentBg,
                      borderRadius: 12,
                      border: `0.8px solid ${F.headerBorder}`,
                      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)',
                      padding: '8px 0',
                      zIndex: 900,
                    }}
                  >
                    {/* User info */}
                    <div style={{ padding: '8px 16px 12px', borderBottom: `0.8px solid ${F.headerBorder}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: F.textPrimary }}>{masterName}</div>
                      <div style={{ fontSize: 13, color: mounted && resolvedTheme === 'dark' ? '#d4d4d4' : '#737373', marginTop: 2 }}>
                        {master?.profile?.full_name || ''}
                      </div>
                    </div>
                    {[
                      { label: 'Мой профиль', href: '/settings' },
                      { label: 'Личные настройки', href: '/settings' },
                      { label: 'Помощь и поддержка', href: '/contact' },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'block',
                          padding: '10px 16px',
                          fontSize: 14,
                          color: F.textPrimary,
                          textDecoration: 'none',
                          transition: 'background 100ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#f5f5f5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div style={{ borderTop: `0.8px solid ${F.headerBorder}`, margin: '4px 0' }} />
                    <button
                      onClick={async () => {
                        setUserMenuOpen(false);
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        router.push('/login');
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 16px',
                        fontSize: 14,
                        color: '#d4163a',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#f5f5f5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Выйти
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
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

        {/* ═══ Content area — Fresha: white bg, full remaining width ═══ */}
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
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </main>
      </div>

      <OnboardingDialog />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
