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
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
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
  UserPlus,
  History,
  Bell,
  Map as MapIcon,
  X as XIcon,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

// IG-style sidebar — hover to expand.
const sidebarNav = [
  { key: 'home', icon: Home, href: '/feed' },
  { key: 'profile', icon: User, href: '/profile' },
  { key: 'calendar', icon: CalendarDays, href: '/my-calendar' },
  { key: 'myMasters', icon: UserPlus, href: '/my-masters' },
  { key: 'family', icon: Users, href: '/profile/family' },
  { key: 'activity', icon: History, href: '/history' },
  { key: 'map', icon: MapIcon, href: '/map' },
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
  const tc = useTranslations('common');
  const tInd = useTranslations('industries');
  const tHeader = useTranslations('clientHeader');
  const tAuth = useTranslations('auth');
  const { clearAuth, userId } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === 'dark';

  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [activeSearchTab, setActiveSearchTab] = useState<'all' | 'procedures' | 'venues' | 'pros'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Location state
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [cityInput, setCityInput] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  // Date/time picker state
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [quickDate, setQuickDate] = useState<'today' | 'tomorrow' | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<'anyTime' | 'morning' | 'afternoon' | 'evening'>('anyTime');
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    try {
      const c = localStorage.getItem('cres-ca-city');
      if (c) setSelectedCity(c);
    } catch {}
  }, []);

  function saveCity(city: string) {
    setSelectedCity(city);
    setCityInput('');
    try { localStorage.setItem('cres-ca-city', city); } catch {}
  }

  function detectLocation() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=ru`);
          const j = await r.json();
          const city = j.address?.city || j.address?.town || j.address?.village || j.address?.county || tHeader('currentLocation');
          saveCity(city);
        } catch {}
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 },
    );
  }

  function pickQuickDate(k: 'today' | 'tomorrow') {
    const d = new Date();
    if (k === 'tomorrow') d.setDate(d.getDate() + 1);
    setPickedDate(d);
    setQuickDate(k);
  }
  function pickDate(d: Date) {
    setPickedDate(d);
    setQuickDate(null);
  }
  function prevMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)); }
  function nextMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)); }
  function isSameDate(a: Date | null, b: Date | null) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function isPastDate(d: Date | null) {
    if (!d) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today;
  }

  const calendarDays = useMemo(() => {
    const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const last = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
    // Monday-first offset
    const offset = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = Array(offset).fill(null);
    for (let i = 1; i <= last.getDate(); i++) days.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), i));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calMonth]);

  const monthLabel = useMemo(
    () => calMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    [calMonth],
  );

  const selectedDateLabel = useMemo(() => {
    if (!pickedDate) return '';
    return pickedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }, [pickedDate]);

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
  const isFeedRoute = useMemo(() => /\/feed\/?$/.test(pathname), [pathname]);

  // Notifications dropdown state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Array<{ id: string; title: string; body: string | null; created_at: string; read_at: string | null }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, created_at, read_at')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (cancelled) return;
      const list = (data ?? []) as typeof notifs;
      setNotifs(list);
      setUnreadCount(list.filter((n) => !n.read_at).length);
    })();
    return () => { cancelled = true; };
  }, [userId, notifOpen]);

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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/');
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top header — Fresha-style global search */}
      <header className="sticky top-0 z-50 relative flex h-[72px] shrink-0 items-center gap-4 border-b bg-background px-4 lg:px-8">
        <Link href="/feed" className="shrink-0 text-2xl font-bold tracking-tight">
          CRES-CA
        </Link>

        {/* 3-segment search pill — sits left-of-center, expands inline into a single search input */}
        <div className="relative hidden md:flex w-full max-w-[620px] ml-6 mr-auto items-center rounded-full border bg-card shadow-sm overflow-hidden h-12">
          <AnimatePresence initial={false} mode="wait">
          {!searchExpanded ? (
          <motion.div
            key="segments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex w-full items-center"
          >
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
              <span className="text-muted-foreground truncate">
                {selectedCity || tHeader('currentLocation')}
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[340px] p-3 rounded-2xl shadow-lg space-y-2">
              <button
                onClick={detectLocation}
                disabled={geoLoading}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                <MapPin className="size-4 text-primary" />
                <span>{geoLoading ? tc('loading') : tHeader('useMyLocation')}</span>
              </button>
              <input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && cityInput.trim()) saveCity(cityInput.trim()); }}
                placeholder={tHeader('searchCity')}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="space-y-0.5 pt-1">
                {['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро'].map((c) => (
                  <button
                    key={c}
                    onClick={() => saveCity(c)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {c}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <span className="h-6 w-px bg-border" />

          {/* Time — calendar + time-of-day */}
          <Popover>
            <PopoverTrigger className="flex-1 flex items-center gap-2 px-5 py-3 text-sm hover:bg-muted/40 transition-colors">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">
                {selectedDateLabel || tHeader('anyTime')}
              </span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[480px] p-0 rounded-2xl shadow-lg overflow-hidden">
              <div className="flex">
                {/* Quick presets */}
                <div className="w-[120px] shrink-0 border-r bg-muted/20 p-2 space-y-1">
                  {(['today', 'tomorrow'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => pickQuickDate(k)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left text-xs transition-colors',
                        quickDate === k ? 'bg-foreground text-background' : 'hover:bg-muted',
                      )}
                    >
                      <div className="font-medium">{tHeader(k)}</div>
                    </button>
                  ))}
                </div>
                {/* Mini calendar */}
                <div className="flex-1 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={prevMonth} className="rounded-lg p-1 hover:bg-muted"><ChevronDown className="size-4 rotate-90" /></button>
                    <span className="text-sm font-medium">{monthLabel}</span>
                    <button onClick={nextMonth} className="rounded-lg p-1 hover:bg-muted"><ChevronDown className="size-4 -rotate-90" /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
                    {['пн','вт','ср','чт','пт','сб','вс'].map((d) => <div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => d && pickDate(d)}
                        disabled={!d}
                        className={cn(
                          'aspect-square rounded-lg text-xs transition-colors',
                          !d && 'invisible',
                          isSameDate(d, pickedDate) ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted',
                          isPastDate(d) && 'text-muted-foreground/40 pointer-events-none',
                        )}
                      >
                        {d?.getDate()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Time of day */}
              <div className="border-t p-3">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">{tHeader('chooseTime')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { k: 'anyTime', range: '' },
                    { k: 'morning', range: '06–12' },
                    { k: 'afternoon', range: '12–17' },
                    { k: 'evening', range: '17–23' },
                  ] as const).map(({ k, range }) => (
                    <button
                      key={k}
                      onClick={() => setTimeOfDay(k)}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-center transition-colors',
                        timeOfDay === k ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                      )}
                    >
                      <div className="text-[11px] font-medium">{tHeader(k)}</div>
                      {range && <div className="mt-0.5 text-[10px] tabular-nums opacity-70">{range}</div>}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={() => setSearchExpanded(true)}
            className="mx-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
            aria-label={tHeader('searchPlaceholder')}
          >
            <Search className="size-4" />
          </button>
          </motion.div>
          ) : (
          <motion.div
            key="searchInput"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex w-full items-center pl-5 pr-1"
          >
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { goSearch(searchInput); setSearchExpanded(false); }
                if (e.key === 'Escape') setSearchExpanded(false);
              }}
              placeholder={tHeader('searchPlaceholder')}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
            />
            <button
              onClick={() => setSearchExpanded(false)}
              className="rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={tc('cancel')}
            >
              <XIcon className="size-4" />
            </button>
            <button
              onClick={() => { goSearch(searchInput); setSearchExpanded(false); }}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
              aria-label={tHeader('searchPlaceholder')}
            >
              <Search className="size-4" />
            </button>
          </motion.div>
          )}
          </AnimatePresence>
        </div>

        <div className="md:hidden flex-1" />

        {/* Notifications bell — dropdown with 5 latest + view-all link */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger
            className="relative flex size-11 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:bg-muted/40"
            aria-label={t('notifications')}
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] p-0 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{t('notifications')}</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                  {unreadCount}
                </span>
              )}
            </div>
            <ul className="max-h-[360px] divide-y divide-border/60 overflow-y-auto">
              {notifs.length === 0 && (
                <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {tHeader('notifEmpty')}
                </li>
              )}
              {notifs.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className={cn(
                      'mt-1 size-2 shrink-0 rounded-full',
                      n.read_at ? 'bg-transparent' : 'bg-rose-500',
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{n.title}</p>
                      {n.body && <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/notifications"
              onClick={() => setNotifOpen(false)}
              className="flex items-center justify-center gap-1.5 border-t bg-muted/30 px-4 py-3 text-xs font-semibold text-[var(--ds-accent)] transition-colors hover:bg-muted/50"
            >
              {tHeader('notifViewAll')}
              <ArrowRight className="size-3.5" />
            </Link>
          </PopoverContent>
        </Popover>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — IG-web style: 72px reserved, expands to overlay on hover (no content shift, no bg change) */}
        <aside className="hidden lg:block w-[72px] shrink-0 relative">
          <div className="group/sb absolute inset-y-0 left-0 w-[72px] hover:w-[240px] transition-[width] duration-200 ease-out flex flex-col justify-center overflow-hidden z-30">
            <nav className="px-3 space-y-1.5">
              {sidebarNav.map(({ key, icon: Icon, href }) => {
                const isActive = pathname.endsWith(href);
                return (
                  <Link
                    key={key}
                    href={href}
                    className={cn(
                      'flex items-center gap-4 rounded-xl px-3 py-3 text-sm transition-colors whitespace-nowrap',
                      isActive
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-[22px] shrink-0" />
                    <span className="opacity-0 group-hover/sb:opacity-100 transition-opacity duration-150">
                      {t(key)}
                    </span>
                  </Link>
                );
              })}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap"
                aria-label={tHeader('toggleTheme')}
              >
                <span className="relative size-[22px] shrink-0">
                  <Sun className={cn('absolute inset-0 size-[22px] transition-all', isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
                  <Moon className={cn('absolute inset-0 size-[22px] transition-all', isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')} />
                </span>
                <span className="opacity-0 group-hover/sb:opacity-100 transition-opacity duration-150">
                  {isDark ? tHeader('lightMode') : tHeader('darkMode')}
                </span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-destructive whitespace-nowrap"
              >
                <LogOut className="size-[22px] shrink-0" />
                <span className="opacity-0 group-hover/sb:opacity-100 transition-opacity duration-150">
                  {tAuth('signOut')}
                </span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div
            className={cn(
              'py-6 lg:py-10',
              isFeedRoute
                ? 'pl-4 lg:pl-10 pr-0' // feed: flush right so the rail mirrors the left sidebar
                : isAccountRoute
                  ? 'mx-auto max-w-[960px] px-4 lg:px-10'
                  : 'mx-auto max-w-[1200px] px-4 lg:px-10',
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
