/** --- YAML
 * name: Dashboard Layout
 * description: Premium admin layout — glassmorphism sidebar with master profile, animated nav, stat-rich header
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Users,
  Briefcase,
  DollarSign,
  Package,
  Megaphone,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'calendar', icon: CalendarDays, href: '/calendar' },
  { key: 'clients', icon: Users, href: '/clients' },
  { key: 'services', icon: Briefcase, href: '/services' },
  { key: 'finance', icon: DollarSign, href: '/finance' },
  { key: 'inventory', icon: Package, href: '/inventory' },
  { key: 'marketing', icon: Megaphone, href: '/marketing' },
  { key: 'settings', icon: Settings, href: '/settings' },
] as const;

function MasterAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-xs font-bold text-primary-foreground ring-2 ring-primary/20">
      {initials}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('dashboard');
  const ta = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { master } = useMaster();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const masterName = master?.profile?.full_name || 'Master';
  const masterSpec = master?.specialization || '';

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r bg-background/95 backdrop-blur-2xl transform transition-transform duration-300 ease-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-black text-primary-foreground tracking-tighter">C</span>
            </div>
            <span className="text-lg font-bold tracking-tight">CRES-CA</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Master profile card */}
        <div className="mx-3 mt-4 mb-2 rounded-xl border bg-card/50 p-3">
          <div className="flex items-center gap-3">
            <MasterAvatar name={masterName} avatarUrl={master?.profile?.avatar_url ?? null} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{masterName}</p>
              {masterSpec && (
                <p className="truncate text-xs text-muted-foreground mt-0.5">{masterSpec}</p>
              )}
            </div>
            <Link
              href="/settings"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
          {navItems.map(({ key, icon: Icon, href }) => {
            const isActive = pathname.includes(href);
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-muted border border-border/50 shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn('relative h-[18px] w-[18px]', isActive && 'text-primary')} />
                <span className="relative">{t(key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />
            {ta('signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-xl px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold">{t('title')}</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
