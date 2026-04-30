/** --- YAML
 * name: MiniAppMasterDetail
 * description: Master profile page in Telegram Mini App — hero, info, tabs (services/portfolio/reviews/about), sticky bottom CTA. Spotify+Pinterest dark theme.
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Star, MapPin, Clock, Loader2, Share2,
  ChevronRight, Camera, MessageSquare, CalendarCheck, Heart, HeartOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';

/* ─── types ─── */

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_minutes: number;
  description: string | null;
  color: string | null;
  category_id: string | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
}

interface ReviewItem {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
}

type WorkingHoursEntry = { start: string; end: string } | null;
type WorkingHoursMap = Record<string, WorkingHoursEntry>;

interface MasterDetail {
  id: string;
  display_name: string | null;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  address: string | null;
  rating: number;
  total_reviews: number;
  avatar_url: string | null;
  full_name: string | null;
  working_hours: WorkingHoursMap | null;
  latitude: number | null;
  longitude: number | null;
  services: ServiceItem[];
  categories: ServiceCategory[];
  portfolio: PortfolioItem[];
  reviews: ReviewItem[];
}

/* ─── constants ─── */

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_NAMES_FULL: Record<string, string> = {
  monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг',
  friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье',
};
const JS_DAY_TO_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const TAB_ITEMS = [
  { key: 'services', label: 'Услуги' },
  { key: 'portfolio', label: 'Портфолио' },
  { key: 'reviews', label: 'Отзывы' },
  { key: 'about', label: 'О нас' },
] as const;

type TabKey = (typeof TAB_ITEMS)[number]['key'];

/* ─── helpers ─── */

function getOpenStatus(wh: WorkingHoursMap | null): { isOpen: boolean; label: string } {
  if (!wh) return { isOpen: false, label: 'Нет расписания' };
  const now = new Date();
  const dayKey = JS_DAY_TO_KEY[now.getDay()];
  const entry = wh[dayKey];
  if (!entry) return { isOpen: false, label: 'Сегодня выходной' };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = entry.start.split(':').map(Number);
  const [endH, endM] = entry.end.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (currentMinutes >= start && currentMinutes < end) {
    return { isOpen: true, label: `Открыто до ${entry.end}` };
  }
  if (currentMinutes < start) {
    return { isOpen: false, label: `Откроется в ${entry.start}` };
  }
  return { isOpen: false, label: 'Закрыто' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── component ─── */

export default function MiniAppMasterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { haptic } = useTelegram();
  const userId = useAuthStore((s) => s.userId);

  const [master, setMaster] = useState<MasterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('services');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  // Refs for scroll-to-section
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<TabKey, HTMLDivElement | null>>({
    services: null,
    portfolio: null,
    reviews: null,
    about: null,
  });
  const tabBarRef = useRef<HTMLDivElement>(null);

  /* ─── data fetching ─── */
  useEffect(() => {
    if (!params?.id) return;
    const supabase = createClient();

    (async () => {
      // Parallel fetches
      const [masterRes, portfolioRes, reviewsRes, categoriesRes] = await Promise.all([
        supabase
          .from('masters')
          .select('id, display_name, specialization, bio, city, address, rating, total_reviews, avatar_url, working_hours, latitude, longitude, profile:profiles!masters_profile_id_fkey(full_name, avatar_url), services(id, name, price, currency, duration_minutes, description, color, category_id, is_active)')
          .eq('id', params.id)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('master_portfolio')
          .select('id, image_url, caption')
          .eq('master_id', params.id)
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
          .limit(18),
        supabase
          .from('reviews')
          .select('id, score, comment, created_at, reviewer:profiles!reviewer_id(full_name)')
          .eq('target_id', params.id)
          .eq('target_type', 'master')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('service_categories')
          .select('id, name, color, sort_order')
          .eq('master_id', params.id)
          .order('sort_order', { ascending: true }),
      ]);

      if (!masterRes.data) {
        setLoading(false);
        return;
      }

      const m = masterRes.data as unknown as {
        id: string;
        display_name: string | null;
        specialization: string | null;
        bio: string | null;
        city: string | null;
        address: string | null;
        rating: number | null;
        total_reviews: number | null;
        avatar_url: string | null;
        working_hours: WorkingHoursMap | null;
        latitude: number | null;
        longitude: number | null;
        profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
        services: Array<ServiceItem & { is_active: boolean }>;
      };

      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;

      const reviews: ReviewItem[] = (reviewsRes.data ?? []).map((r: unknown) => {
        const rv = r as {
          id: string;
          score: number;
          comment: string | null;
          created_at: string;
          reviewer: { full_name: string | null } | { full_name: string | null }[] | null;
        };
        const reviewer = Array.isArray(rv.reviewer) ? rv.reviewer[0] : rv.reviewer;
        return {
          id: rv.id,
          score: rv.score,
          comment: rv.comment,
          created_at: rv.created_at,
          reviewer_name: reviewer?.full_name ?? null,
        };
      });

      setMaster({
        id: m.id,
        display_name: m.display_name,
        specialization: m.specialization,
        bio: m.bio,
        city: m.city,
        address: m.address,
        rating: Number(m.rating ?? 0),
        total_reviews: Number(m.total_reviews ?? 0),
        avatar_url: m.avatar_url ?? p?.avatar_url ?? null,
        full_name: p?.full_name ?? null,
        working_hours: m.working_hours,
        latitude: m.latitude ?? null,
        longitude: m.longitude ?? null,
        services: (m.services ?? []).filter((s) => s.is_active),
        categories: (categoriesRes.data ?? []) as ServiceCategory[],
        portfolio: (portfolioRes.data ?? []) as PortfolioItem[],
        reviews,
      });
      setLoading(false);
    })();
  }, [params?.id]);

  /* ─── load follow state ─── */
  useEffect(() => {
    if (!params?.id || !userId) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('client_master_links')
        .select('profile_id')
        .eq('profile_id', userId)
        .eq('master_id', params.id)
        .maybeSingle();
      setFollowing(Boolean(data));
    })();
  }, [params?.id, userId]);

  /* ─── follow toggle ─── */
  const toggleFollow = useCallback(async () => {
    if (!master || followBusy) return;
    if (!userId) {
      router.push('/telegram/welcome');
      return;
    }
    haptic('selection');
    setFollowBusy(true);
    try {
      const res = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: master.id }),
      });
      if (res.ok) {
        const j = (await res.json()) as { following: boolean };
        setFollowing(j.following);
      }
    } finally {
      setFollowBusy(false);
    }
  }, [master, followBusy, userId, haptic, router]);

  /* ─── share ─── */
  const handleShare = useCallback(() => {
    if (!master) return;
    haptic('light');
    const url = `${window.location.origin}/telegram/search/${master.id}`;
    const text = `${master.display_name ?? master.full_name ?? 'Мастер'} — ${master.specialization ?? 'Профессионал'}`;

    // Try Telegram share first
    if (typeof window !== 'undefined' && (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp?.openTelegramLink) {
      (window as unknown as { Telegram: { WebApp: { openTelegramLink: (url: string) => void } } }).Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
      );
      return;
    }

    // Fallback: copy to clipboard
    navigator.clipboard?.writeText(url);
  }, [master, haptic]);

  /* ─── intersection observer for active tab ─── */
  useEffect(() => {
    if (!master) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute('data-section') as TabKey | null;
            if (key) setActiveTab(key);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const key of Object.keys(sectionRefs.current) as TabKey[]) {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [master]);

  /* ─── show bottom bar after scrolling past hero ─── */
  useEffect(() => {
    const onScroll = () => {
      setShowBottomBar(window.scrollY > 240);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ─── scroll to section ─── */
  const scrollToSection = useCallback((key: TabKey) => {
    haptic('light');
    setActiveTab(key);
    const el = sectionRefs.current[key];
    if (el) {
      const offset = 60; // tab bar height
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, [haptic]);

  /* ─── filtered services ─── */
  const filteredServices = useMemo(() => {
    if (!master) return [];
    if (!activeCategory) return master.services;
    return master.services.filter((s) => s.category_id === activeCategory);
  }, [master, activeCategory]);

  /* ─── open status ─── */
  const openStatus = useMemo(() => {
    return master ? getOpenStatus(master.working_hours) : { isOpen: false, label: '' };
  }, [master]);

  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];

  /* ─── loading ─── */
  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="size-8 animate-spin text-neutral-400" />
        </motion.div>
      </div>
    );
  }

  /* ─── not found ─── */
  if (!master) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5"
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-white/5">
          <MapPin className="size-6 text-neutral-400" />
        </div>
        <p className="text-sm text-neutral-500">Мастер не найден</p>
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="mt-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-neutral-800 active:scale-95 transition-transform"
          style={{ minHeight: 44 }}
        >
          Назад
        </button>
      </motion.div>
    );
  }

  const name = master.display_name ?? master.full_name ?? '—';
  const activeServicesCount = master.services.length;

  return (
    <div ref={scrollContainerRef} className="relative min-h-screen pb-28">
      {/* ━━━ HERO ━━━ */}
      <div ref={heroRef} className="relative h-[200px] overflow-hidden">
        {/* Background */}
        {master.avatar_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={master.avatar_url}
              alt=""
              className="absolute inset-0 size-full object-cover scale-110 blur-sm brightness-50"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-rose-500">
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
          </div>
        )}

        {/* Overlay buttons */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4"
          style={{ paddingTop: 'calc(var(--tg-content-top, 0px) + 16px)' }}
        >
          <button
            onClick={() => { haptic('light'); router.back(); }}
            className="flex size-10 items-center justify-center rounded-full bg-white shadow-md active:scale-90 transition-transform"
            aria-label="Назад"
          >
            <ArrowLeft className="size-[18px] text-neutral-900" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`flex size-10 items-center justify-center rounded-full shadow-md active:scale-90 transition-transform disabled:opacity-60 ${
                following ? 'bg-rose-500 text-white' : 'bg-white text-rose-500'
              }`}
              aria-label={following ? 'Убрать из контактов' : 'В контакты'}
            >
              {followBusy ? (
                <Loader2 className="size-[18px] animate-spin" />
              ) : following ? (
                <HeartOff className="size-[18px]" />
              ) : (
                <Heart className="size-[18px]" />
              )}
            </button>
            <button
              onClick={handleShare}
              className="flex size-10 items-center justify-center rounded-full bg-white shadow-md active:scale-90 transition-transform"
              aria-label="Поделиться"
            >
              <Share2 className="size-[18px] text-neutral-900" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* ━━━ INFO SECTION ━━━ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 -mt-10 px-5"
      >
        {/* Avatar */}
        <div className="flex items-end gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 text-2xl font-bold ring-4 ring-[#121212] shadow-2xl">
            {master.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={master.avatar_url} alt={name} className="size-full object-cover" />
            ) : (
              <span className="text-neutral-900">{name[0]?.toUpperCase() ?? 'M'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-xl font-bold leading-tight text-neutral-900">{name}</h1>
            {master.specialization && (
              <p className="mt-0.5 truncate text-[13px] text-neutral-600">{master.specialization}</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
          {master.rating > 0 && (
            <div className="flex items-center gap-1 text-neutral-800">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{master.rating.toFixed(1)}</span>
              <span className="text-neutral-400">({master.total_reviews})</span>
            </div>
          )}
          {master.city && (
            <div className="flex items-center gap-1 text-neutral-600">
              <MapPin className="size-3" />
              <span className="truncate">{master.city}</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 ${openStatus.isOpen ? 'text-emerald-400' : 'text-neutral-400'}`}>
            <div className={`size-1.5 rounded-full ${openStatus.isOpen ? 'bg-emerald-400' : 'bg-white/30'}`} />
            <span className="text-[11px] font-medium">{openStatus.label}</span>
          </div>
        </div>
      </motion.div>

      {/* ━━━ TAB BAR (sticky) ━━━ */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-30 mt-5 border-b border-neutral-200 bg-[#121212]/95 backdrop-blur-xl"
      >
        <div className="flex gap-0 px-5">
          {TAB_ITEMS.map((tab) => {
            // Hide portfolio/reviews tabs if empty
            if (tab.key === 'portfolio' && master.portfolio.length === 0) return null;
            if (tab.key === 'reviews' && master.reviews.length === 0) return null;

            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => scrollToSection(tab.key)}
                className={`relative px-3 py-3 text-[13px] font-medium transition-colors ${
                  isActive ? 'text-neutral-900' : 'text-neutral-500'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-white"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ━━━ SECTIONS ━━━ */}
      <div className="mt-1 space-y-8 px-5 pt-4">

        {/* ── Services ── */}
        <div
          ref={(el) => { sectionRefs.current.services = el; }}
          data-section="services"
        >
          <h2 className="mb-3 text-[15px] font-bold text-neutral-900">
            Услуги
            {activeServicesCount > 0 && (
              <span className="ml-2 text-[12px] font-normal text-neutral-400">{activeServicesCount}</span>
            )}
          </h2>

          {/* Category pills */}
          {master.categories.length > 0 && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => { haptic('light'); setActiveCategory(null); }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
                  !activeCategory
                    ? 'bg-white text-black'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                Все
              </button>
              {master.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { haptic('light'); setActiveCategory(cat.id); }}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-white text-black'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Service list */}
          {filteredServices.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-8 text-center">
              <p className="text-[13px] text-neutral-400">Пока нет активных услуг</p>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredServices.map((s, i) => (
                  <motion.li
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                  >
                    <div className="group rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4 transition-colors hover:bg-neutral-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Color dot + name */}
                          <div className="flex items-center gap-2">
                            {s.color && (
                              <div
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                            )}
                            <p className="truncate text-[14px] font-semibold text-neutral-900">{s.name}</p>
                          </div>

                          {/* Duration */}
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                            <Clock className="size-3" />
                            <span>{s.duration_minutes} мин</span>
                          </div>

                          {/* Description */}
                          {s.description && (
                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-neutral-400">
                              {s.description}
                            </p>
                          )}
                        </div>

                        {/* Price + book button */}
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="text-[15px] font-bold text-neutral-900">
                            {Number(s.price).toFixed(0)}<span className="ml-0.5 text-[12px] font-normal text-neutral-500">{s.currency === 'UAH' ? '₴' : s.currency}</span>
                          </p>
                          <button
                            onClick={() => {
                              haptic('light');
                              router.push(`/telegram/book?master_id=${master.id}&service_id=${s.id}`);
                            }}
                            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-[11px] font-medium text-neutral-800 active:scale-95 transition-all hover:bg-white/10"
                          >
                            Записаться
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* ── Portfolio ── */}
        {master.portfolio.length > 0 && (
          <div
            ref={(el) => { sectionRefs.current.portfolio = el; }}
            data-section="portfolio"
          >
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-neutral-900">
              <Camera className="size-4 text-neutral-500" />
              Портфолио
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                {master.portfolio.length}
              </span>
            </h2>

            <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
              {master.portfolio.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  onClick={() => { haptic('light'); setPortfolioOpen(item.id); }}
                  className="relative aspect-square overflow-hidden bg-white/5 active:scale-[0.97] transition-transform"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.caption ?? ''}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </motion.button>
              ))}
            </div>

            {/* Lightbox */}
            <AnimatePresence>
              {portfolioOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/85 backdrop-blur-lg p-4"
                  onClick={() => setPortfolioOpen(null)}
                >
                  {(() => {
                    const item = master.portfolio.find((p) => p.id === portfolioOpen);
                    if (!item) return null;
                    return (
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.85, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="relative max-h-[80vh] max-w-full overflow-hidden rounded-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image_url} alt={item.caption ?? ''} className="max-h-[80vh] object-contain" />
                        {item.caption && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                            <p className="text-[13px] text-neutral-900">{item.caption}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Reviews ── */}
        {master.reviews.length > 0 && (
          <div
            ref={(el) => { sectionRefs.current.reviews = el; }}
            data-section="reviews"
          >
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-neutral-900">
              <MessageSquare className="size-4 text-neutral-500" />
              Отзывы
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                {master.total_reviews}
              </span>
            </h2>

            {/* Rating summary */}
            <div className="mb-4 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-neutral-900">{master.rating.toFixed(1)}</p>
                <div className="mt-1 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3 ${i < Math.round(master.rating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-900/15'}`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-neutral-400">{master.total_reviews} отзывов</p>
              </div>
            </div>

            {/* Review cards */}
            <ul className="space-y-2.5">
              {master.reviews.map((r, i) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-neutral-600">
                        {(r.reviewer_name ?? 'К')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-neutral-900">{r.reviewer_name ?? 'Клиент'}</p>
                        <p className="text-[10px] text-neutral-400">{formatDate(r.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-3 ${i < r.score ? 'fill-amber-400 text-amber-400' : 'text-neutral-900/15'}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2.5 text-[12px] leading-relaxed text-neutral-600">{r.comment}</p>
                  )}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* ── About ── */}
        <div
          ref={(el) => { sectionRefs.current.about = el; }}
          data-section="about"
        >
          <h2 className="mb-3 text-[15px] font-bold text-neutral-900">О нас</h2>

          {/* Bio */}
          {master.bio && (
            <div className="mb-4 rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4">
              <p className="text-[13px] leading-relaxed text-neutral-700">{master.bio}</p>
            </div>
          )}

          {/* Working hours */}
          {master.working_hours && (
            <div className="mb-4 rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-neutral-800">Часы работы</h3>
              <ul className="space-y-2">
                {DAYS_ORDER.map((day) => {
                  const h = master.working_hours?.[day];
                  const isToday = day === todayKey;
                  return (
                    <li
                      key={day}
                      className={`flex items-center justify-between text-[12px] ${
                        isToday ? 'font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`size-2 rounded-full ${
                            h ? 'bg-emerald-500' : 'bg-white/20'
                          }`}
                        />
                        <span className={isToday ? 'text-neutral-900' : 'text-neutral-600'}>
                          {DAY_NAMES_FULL[day]}
                        </span>
                      </div>
                      <span
                        className={
                          h
                            ? isToday
                              ? 'text-neutral-900 font-bold'
                              : 'text-neutral-700 font-medium'
                            : 'text-neutral-400'
                        }
                      >
                        {h ? `${h.start} — ${h.end}` : 'Выходной'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Address */}
          {(master.city || master.address) && (
            <div className="rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-neutral-700">
                    {[master.address, master.city].filter(Boolean).join(', ')}
                  </p>
                  {(master.latitude && master.longitude) && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${master.latitude},${master.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-400 active:text-violet-600 transition-colors"
                      onClick={() => haptic('light')}
                    >
                      Проложить маршрут
                      <ChevronRight className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ━━━ STICKY BOTTOM BAR ━━━ */}
      <AnimatePresence>
        {showBottomBar && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-xl"
            style={{ paddingBottom: 'calc(var(--tg-content-bottom, 0px) + 8px)' }}
          >
            <div className="flex items-center justify-between px-5 py-3">
              <div className="text-[13px] text-neutral-500">
                <span className="font-semibold text-neutral-900">{activeServicesCount}</span>{' '}
                {activeServicesCount === 1 ? 'услуга' : activeServicesCount < 5 ? 'услуги' : 'услуг'}
              </div>
              <button
                onClick={() => {
                  haptic('selection');
                  router.push(`/telegram/book?master_id=${master.id}`);
                }}
                className="flex items-center gap-2 rounded-2xl bg-white px-6 py-2.5 text-[14px] font-semibold text-black active:scale-[0.97] transition-transform shadow-lg shadow-white/10"
              >
                <CalendarCheck className="size-4" />
                Записаться
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
