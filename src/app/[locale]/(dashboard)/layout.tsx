/** --- YAML
 * name: Dashboard Layout
 * description: Admin layout with macOS-style bottom dock navigation and floating header
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CalendarDays,
  Users,
  Briefcase,
  DollarSign,
  Package,
  Megaphone,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';
import { Dock, DockIcon, DockSeparator } from '@/components/ui/dock';

const navItems = [
  { key: 'calendar', icon: CalendarDays, href: '/calendar' },
  { key: 'clients', icon: Users, href: '/clients' },
  { key: 'services', icon: Briefcase, href: '/services' },
  { key: 'finance', icon: DollarSign, href: '/finance' },
  { key: 'inventory', icon: Package, href: '/inventory' },
  { key: 'marketing', icon: Megaphone, href: '/marketing' },
  { key: 'settings', icon: Settings, href: '/settings' },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('dashboard');
  const ta = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const { master } = useMaster();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const masterName = master?.profile?.full_name || 'Master';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-[10px] font-black text-primary-foreground tracking-tighter">C</span>
            </div>
            <span className="text-base font-bold tracking-tight hidden sm:inline">CRES-CA</span>
          </Link>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <h1 className="text-sm font-semibold text-muted-foreground hidden sm:block">{t('title')}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {master?.profile?.avatar_url ? (
              <img
                src={master.profile.avatar_url}
                alt={masterName}
                className="h-6 w-6 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span className="hidden sm:inline max-w-[120px] truncate">{masterName}</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title={ta('signOut')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-28">
        {children}
      </main>

      {/* Bottom dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <Dock>
          {navItems.slice(0, 5).map(({ key, icon, href }) => (
            <DockIcon
              key={key}
              icon={icon}
              label={t(key)}
              isActive={pathname.includes(href)}
              onClick={() => router.push(href)}
            />
          ))}
          <DockSeparator />
          {navItems.slice(5).map(({ key, icon, href }) => (
            <DockIcon
              key={key}
              icon={icon}
              label={t(key)}
              isActive={pathname.includes(href)}
              onClick={() => router.push(href)}
            />
          ))}
        </Dock>
      </div>
    </div>
  );
}
