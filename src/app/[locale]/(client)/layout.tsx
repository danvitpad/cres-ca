/** --- YAML
 * name: Client Layout
 * description: Client shell — global top search header, account sidebar with 10 sections (profile/family/activity/masters/favorites/wallet/forms/reviews/notifications/settings), mobile bottom tabs
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
  Heart,
  Wallet,
  Settings,
  History,
  Search,
  MapPin,
  Clock,
  ClipboardList,
  Globe,
  HelpCircle,
  Download,
  Building2,
  ChevronDown,
  Sparkles,
  Scissors,
  Paintbrush,
  Hand,
  Flower2,
  Smile,
  Syringe,
  Droplet,
  UserPlus,
  Star,
  Bell,
  UsersRound,
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

const accountNav = [
  { key: 'profile', icon: User, href: '/profile' },
  { key: 'family', icon: UsersRound, href: '/profile/family' },
  { key: 'activity', icon: History, href: '/history' },
  { key: 'myMasters', icon: UserPlus, href: '/my-masters' },
  { key: 'favorites', icon: Heart, href: '/favorites' },
  { key: 'wallet', icon: Wallet, href: '/wallet' },
  { key: 'forms', icon: ClipboardList, href: '/forms' },
  { key: 'reviews', icon: Star, href: '/reviews' },
  { key: 'notifications', icon: Bell, href: '/notifications' },
  { key: 'accountSettings', icon: Settings, href: '/account-settings' },
] as const;

const accountRoutes = [
  '/profile',
  '/history',
  '/my-masters',
  '/favorites',
  '/wallet',
  '/forms',
  '/reviews',
  '/notifications',
  '/account-settings',
];

const mobileTabs = [
  { key: 'feed', icon: Home, href: '/feed', center: false },
  { key: 'calendar', icon: CalendarDays, href: '/my-calendar', center: false },
  { key: 'book', icon: Plus, href: '/book', center: true },
  { key: 'masters', icon: Users, href: '/masters', center: false },
  { key: 'profile', icon: User, href: '/profile', center: false },
] as const;

const serviceCategories = [
  { key: 'allServices', icon: Sparkles },
  { key: 'hairStyling', icon: Scissors },
  { key: 'nails', icon: Hand },
  { key: 'hairRemoval', icon: Droplet },
  { key: 'browsLashes', icon: Smile },
  { key: 'faceSkinCare', icon: Flower2 },
  { key: 'massage', icon: Hand },
  { key: 'makeup', icon: Paintbrush },
  { key: 'aestheticMedicine', icon: Syringe },
  { key: 'barbers', icon: Scissors },
] as const;

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('clientNav');
  const tSvc = useTranslations('serviceCategories');
  const tHeader = useTranslations('clientHeader');
  const tAuth = useTranslations('auth');
  const { userId, clearAuth } = useAuthStore();

  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');
  const [activeSearchTab, setActiveSearchTab] = useState<'all' | 'procedures' | 'venues' | 'pros'>('all');
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
              <div className="max-h-[380px] overflow-y-auto p-2">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {tHeader('procedures')}
                </p>
                {serviceCategories.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <span>{tSvc(key)}</span>
                  </button>
                ))}
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

          <button className="mx-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95">
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
          <DropdownMenuContent align="end" className="w-[240px] rounded-2xl shadow-lg">
            <div className="px-3 py-2 text-sm font-semibold truncate">
              {displayName || t('myAccount')}
            </div>
            <DropdownMenuSeparator />
            {accountNav.map(({ key, icon: Icon, href }) => (
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 cursor-pointer">
              <Download className="size-4" />
              <span>{tHeader('downloadApp')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer">
              <HelpCircle className="size-4" />
              <span>{tHeader('helpCenter')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 cursor-pointer">
              <Globe className="size-4" />
              <span>{tHeader('language')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/login" />}
              className="gap-2.5 cursor-pointer"
            >
              <Building2 className="size-4" />
              <span>{tHeader('forBusiness')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop account sidebar — only on account routes */}
        {isAccountRoute && (
          <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r bg-card">
            <div className="px-6 pt-7 pb-4">
              <p className="text-base font-semibold text-foreground truncate">
                {displayName || t('myAccount')}
              </p>
            </div>

            <nav className="flex-1 px-3 space-y-0.5">
              {accountNav.map(({ key, icon: Icon, href }) => {
                const isActive = pathname.endsWith(href);
                return (
                  <Link
                    key={key}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                      isActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    <span>{t(key)}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

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
