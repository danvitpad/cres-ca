/** --- YAML
 * name: Dashboard Layout
 * description: Premium master dashboard with collapsible sidebar, header bar, and command palette
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Users,
  Briefcase,
  DollarSign,
  Package,
  Megaphone,
  Settings,
  LogOut,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  HelpCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { CommandPalette, useCommandPalette } from '@/components/shared/primitives/command-palette';
import { OnboardingDialog } from '@/components/shared/onboarding-dialog';

const mainNav = [
  { key: 'calendar', icon: CalendarDays, href: '/calendar' },
  { key: 'clients', icon: Users, href: '/clients' },
  { key: 'services', icon: Briefcase, href: '/services' },
] as const;

const businessNav = [
  { key: 'finance', icon: DollarSign, href: '/finance' },
  { key: 'inventory', icon: Package, href: '/inventory' },
  { key: 'marketing', icon: Megaphone, href: '/marketing' },
] as const;

const tierBadge: Record<string, { label: string; className: string }> = {
  trial: { label: 'Trial', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  starter: { label: 'Starter', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  pro: { label: 'Pro', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  business: { label: 'Business', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const tAuth = useTranslations('auth');
  const tNav = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const { master } = useMaster();
  const { tier } = useAuthStore();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const masterName = master?.profile?.full_name || 'Master';
  const badge = tierBadge[tier ?? 'trial'] ?? tierBadge.trial;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const renderNavItem = useCallback(
    (item: { key: string; icon: React.ComponentType<{ className?: string }>; href: string }) => {
      const Icon = item.icon;
      const isActive = pathname.includes(item.href);
      return (
        <Link
          key={item.key}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--ds-accent)]"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Icon className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span className="truncate">{t(item.key)}</span>}
        </Link>
      );
    },
    [pathname, collapsed, t],
  );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-accent)]">
          <span className="text-xs font-black text-white tracking-tighter">C</span>
        </div>
        {!collapsed && <span className="text-base font-bold tracking-tight">CRES-CA</span>}
      </div>

      {/* Search trigger */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{t('searchPlaceholder')}</span>
            <kbd className="rounded border bg-background px-1 py-0.5 text-[10px]">
              {typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+'}K
            </kbd>
          </button>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-4 scrollbar-thin">
        <p className={cn('mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', collapsed && 'sr-only')}>
          Main
        </p>
        {mainNav.map(renderNavItem)}

        <div className="my-3 h-px bg-border" />

        <p className={cn('mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', collapsed && 'sr-only')}>
          Business
        </p>
        {businessNav.map(renderNavItem)}

        <div className="my-3 h-px bg-border" />

        {renderNavItem({ key: 'settings', icon: Settings, href: '/settings' })}

        <Link
          href="/contact"
          target="_blank"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center',
          )}
        >
          <HelpCircle className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>{tNav('helpSupport')}</span>}
        </Link>
      </nav>

      {/* User card */}
      <div className="shrink-0 border-t p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <AvatarRing
            src={master?.profile?.avatar_url}
            name={masterName}
            size={collapsed ? 32 : 36}
            status="online"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{masterName}</p>
              <span className={cn('inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
                {badge.label}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={tAuth('signOut')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="hidden lg:flex h-8 w-8 items-center justify-center absolute -right-3 top-20 rounded-full border bg-card shadow-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--surface-secondary)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'relative hidden lg:flex flex-col shrink-0 border-r bg-card transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-[260px]',
        )}
      >
        {sidebarContent}
      </aside>

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
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r bg-card lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4 lg:px-6">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page title — derived from pathname */}
          <h1 className="text-lg font-semibold">
            {getPageTitle(pathname, t)}
          </h1>

          <div className="flex-1" />

          {/* Global search (desktop) */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{t('searchPlaceholder')}</span>
            <kbd className="rounded border bg-background px-1 py-0.5 text-[10px]">⌘K</kbd>
          </button>

          {/* Notifications */}
          <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Bell className="h-5 w-5" />
            {/* Unread dot */}
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--ds-danger)]" />
          </button>

          {/* Avatar (mobile) */}
          <Link href="/settings" className="lg:hidden">
            <AvatarRing
              src={master?.profile?.avatar_url}
              name={masterName}
              size={32}
            />
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-[var(--space-page)]">
          {children}
        </main>
      </div>

      {/* Onboarding */}
      <OnboardingDialog />

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

function getPageTitle(pathname: string, t: ReturnType<typeof useTranslations<'dashboard'>>) {
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const keys: Record<string, string> = {
    calendar: 'calendar',
    clients: 'clients',
    services: 'services',
    finance: 'finance',
    inventory: 'inventory',
    marketing: 'marketing',
    settings: 'settings',
  };
  const key = keys[lastSegment ?? ''];
  if (key) {
    try { return t(key); } catch { /* fallback */ }
  }
  return t('title');
}
