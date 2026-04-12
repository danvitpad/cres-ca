/** --- YAML
 * name: Client Layout
 * description: Client shell — Fresha-style header, IG-web style hover-expand sidebar, slim profile dropdown, mobile bottom tabs
 * updated: 2026-04-12
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  CalendarDays,
  Plus,
  Users,
  User,
  LogOut,
  Wallet,
  Settings,
  Search,
  MapPin,
  Clock,
  ChevronDown,
  Sparkles,
  Scissors,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

// IG-style sidebar — hover to expand. Order: profile → calendar → myMasters → wallet → settings.
const sidebarNav = [
  { key: 'profile', icon: User, href: '/profile' },
  { key: 'calendar', icon: CalendarDays, href: '/my-calendar' },
  { key: 'myMasters', icon: UserPlus, href: '/my-masters' },
  { key: 'wallet', icon: Wallet, href: '/wallet' },
  { key: 'accountSettings', icon: Settings, href: '/account-settings' },
] as const;

// Profile dropdown — only Главная, Профиль, Кошелёк, Настройки, Выход.
const dropdownNav = [
  { key: 'home', icon: Home, href: '/feed' },
  { key: 'profile', icon: User, href: '/profile' },
  { key: 'wallet', icon: Wallet, href: '/wallet' },
  { key: 'accountSettings', icon: Settings, href: '/account-settings' },
] as const;

const accountRoutes = [
  '/profile',
  '/wallet',
  '/account-settings',
  '/my-masters',
];

const mobileTabs = [
  { key: 'home', icon: Home, href: '/feed', center: false },
  { key: 'calendar', icon: CalendarDays, href: '/my-calendar', center: false },
  { key: 'book', icon: Plus, href: '/book', center: true },
  { key: 'myMasters', icon: UserPlus, href: '/my-masters', center: false },
  { key: 'profile', icon: User, href: '/profile', center: false },
] as const;

const headerCategories = [
  { key: 'allServices', icon: Sparkles },
  { key: 'beauty', icon: Sparkles },
  { key: 'health', icon: Sparkles },
  { key: 'wellness', icon: Sparkles },
  { key: 'home', icon: Sparkles },
  { key: 'auto', icon: Sparkles },
  { key: 'fitness', icon: Sparkles },
  { key: 'education', icon: Sparkles },
] as const;

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('clientNav');
  const tInd = useTranslations('industries');
  const tHeader = useTranslations('clientHeader');
  const tAuth = useTranslations('auth');
  const { userId, clearAuth } = useAuthStore();

  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');
  const [activeSearchTab, setActiveSearchTab] = useState<'all' | 'procedures' | 'venues' | 'pros'>('all');
  const [searchInput, setSearchInput] = useState('');

  const goSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    router.push(trimmed ? `/masters?q=${encodeURIComponent(trimmed)}` : '/masters');
  }, [router]);
  const lastScrollY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAccountRoute = useMemo(
    () => accountRoutes.some((r) => pathname.includes(r)),
    [pathname],
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentY = el.scrollTop;
    if (currentY > lastScrollY.current && currentY > 60) setTabBarVisible(false);
    else setTabBarVisible(true);
    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setDisplayName(data.full_name);
      });
  }, [userId]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/');
  }

  const initial = (displayName || 'U')[0].toUpperCase();

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top header — Fresha-style global search */}
      <header className="sticky top-0 z-50 flex h-[72px] shrink-0 items-center gap-4 border-b bg-background px-4 lg:px-8">
        <Link href="/feed" className="shrink-0 text-2xl font-bold tracking-tight">
          CRES-CA
        </Link>

        {/* 3-segment search pill */}
        <div className="hidden md:flex flex-1 max-w-[620px] mx-auto items-center rounded-full border bg-card shadow-sm">
          {/* Services */}
          <Popover>
            <PopoverTrigger className="flex-1 flex items-center gap-2 px-5 py-3 text-sm rounded-l-full hover:bg-muted/40 transition-colors">
              <span className="text-muted-foreground truncate">{tHeader('allServices')}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[520px] p-0 rounded-2xl shadow-lg">
              <div className="flex gap-1 border-b px-4 pt-4 pb-0">
                {(['all', 'procedures', 'venues', 'pros'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSearchTab(tab)}
                    className={cn(
                      'relative px-4 py-2 text-sm rounded-full transition-colors',
                      activeSearchTab === tab
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tHeader(`tab_${tab}`)}
                  </button>
                ))}
              </div>
              <div className="border-b px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') goSearch(searchInput); }}
                    placeholder={tHeader('searchPlaceholder')}
                    className="w-full rounded-full border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="max-h-[380px] overflow-y-auto p-2">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {tHeader('procedures')}
                </p>
                {headerCategories.map(({ key, icon: Icon }) => {
                  const label = key === 'allServices' ? tHeader('allServices') : tInd(key);
                  return (
                    <button
                      key={key}
                      onClick={() => goSearch(key === 'allServices' ? '' : label)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                    >
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <span className="h-6 w-px bg-border" />

          {/* Location */}
          <Popover>
            <PopoverTrigger className="flex-1 flex items-center gap-2 px-5 py-3 text-sm hover:bg-muted/40 transition-colors">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{tHeader('currentLocation')}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] p-3 rounded-2xl shadow-lg">
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors">
                <MapPin className="size-4 text-primary" />
                <span>{tHeader('currentLocation')}</span>
              </button>
            </PopoverContent>
          </Popover>

          <span className="h-6 w-px bg-border" />

          {/* Time */}
          <Popover>
            <PopoverTrigger className="flex-1 flex items-center gap-2 px-5 py-3 text-sm hover:bg-muted/40 transition-colors">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{tHeader('anyTime')}</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] p-3 rounded-2xl shadow-lg space-y-1">
              {(['today', 'tomorrow', 'anyTime', 'morning', 'afternoon', 'evening'] as const).map((k) => (
                <button
                  key={k}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Clock className="size-4 text-muted-foreground" />
                  <span>{tHeader(k)}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            onClick={() => goSearch(searchInput)}
            className="mx-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
          >
            <Search className="size-4" />
          </button>
        </div>

        <div className="md:hidden flex-1" />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-full border bg-card pr-2 pl-0.5 py-0.5 hover:bg-muted/40 transition-colors">
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-semibold">
              {initial}
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px] rounded-2xl shadow-lg p-1.5">
            {dropdownNav.map(({ key, icon: Icon, href }) => (
              <DropdownMenuItem
                key={key}
                render={<Link href={href} />}
                className="gap-2.5 cursor-pointer"
              >
                <Icon className="size-4" />
                <span>{t(key)}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="gap-2.5 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              <span>{tAuth('signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — IG-web style: collapsed (72px) by default, expand to 240px on hover */}
        <aside className="group/sb hidden lg:flex w-[72px] hover:w-[240px] shrink-0 flex-col border-r bg-card overflow-hidden transition-[width] duration-200 ease-out">
          <nav className="flex-1 px-3 pt-5 space-y-1">
            {sidebarNav.map(({ key, icon: Icon, href }) => {
              const isActive = pathname.endsWith(href);
              return (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    'flex items-center gap-4 rounded-xl px-3 py-3 text-sm transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-[22px] shrink-0" />
                  <span className="opacity-0 group-hover/sb:opacity-100 transition-opacity duration-150">
                    {t(key)}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div
            className={cn(
              'mx-auto px-4 py-6 lg:px-10 lg:py-10',
              isAccountRoute ? 'max-w-[960px]' : 'max-w-[1200px]',
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <motion.nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
        initial={false}
        animate={{ y: tabBarVisible ? 0 : 80 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      >
        {mobileTabs.map(({ key, icon: Icon, href, center }) => {
          const isActive = pathname.includes(href);
          if (center) {
            return (
              <Link
                key={key}
                href={href}
                className="relative -mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90"
              >
                <Icon className="h-6 w-6" strokeWidth={2.5} />
              </Link>
            );
          }
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon
                className={cn('h-5 w-5 transition-all', isActive && 'scale-110')}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="font-medium">{t(key)}</span>
              {isActive && (
                <motion.div
                  layoutId="client-tab-dot"
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}
