/** --- YAML
 * name: MiniAppMasterDetail
 * description: Master profile page in Telegram Mini App — hero, info, tabs (services/portfolio/reviews/about), sticky bottom CTA. Spotify+Pinterest dark theme.
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Star, MapPin, Clock, Loader2, Share2,
  ChevronRight, Camera, MessageSquare, CalendarCheck, Heart, HeartOff,
  Copy, Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-master-page.css';

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

// Working_hours приходит в новом multi-interval формате
// { enabled, intervals: [{start, end}, ...] }, но в БД могут оставаться
// старые записи в single-interval формате { start, end }. Поддерживаем оба
// (нормализуем в один на читаемом этапе).
type WorkingInterval = { start: string; end: string };
type WorkingHoursEntry =
  | { enabled?: boolean; intervals?: WorkingInterval[] }
  | { start: string; end: string }
  | null
  | undefined;
type WorkingHoursMap = Record<string, WorkingHoursEntry>;

type WorkingDay = WorkingInterval;

function getDayIntervals(entry: WorkingHoursEntry): WorkingInterval[] {
  if (!entry) return [];
  if ('intervals' in entry && Array.isArray(entry.intervals)) {
    if (entry.enabled === false) return [];
    return entry.intervals.filter(
      (i): i is WorkingInterval => typeof i?.start === 'string' && typeof i?.end === 'string',
    );
  }
  if ('start' in entry && 'end' in entry && typeof entry.start === 'string' && typeof entry.end === 'string') {
    return [{ start: entry.start, end: entry.end }];
  }
  return [];
}

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
  workplace_photo_url: string | null;
  served_clients_count: number;
  completed_appointments_count: number;
  full_name: string | null;
  /** CRES-CA публичный handle. Берём slug, иначе invite_code. Используется
   *  для копирования ссылки на публичную страницу мастера. */
  cresHandle: string | null;
  working_hours: WorkingHoursMap | null;
  latitude: number | null;
  longitude: number | null;
  services: ServiceItem[];
  categories: ServiceCategory[];
  portfolio: PortfolioItem[];
  reviews: ReviewItem[];
  partners: PartnerItem[];
}

interface PartnerItem {
  id: string;
  display_name: string | null;
  full_name: string | null;
  specialization: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_reviews: number | null;
}

/* ─── constants ─── */

type Lang = 'uk' | 'ru' | 'en';

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_NAMES_BY_LANG: Record<Lang, Record<string, string>> = {
  uk: {
    monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер',
    friday: "П'ятниця", saturday: 'Субота', sunday: 'Неділя',
  },
  ru: {
    monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг',
    friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье',
  },
  en: {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
    friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  },
};
const JS_DAY_TO_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// Ключи табов стабильные, подписи берём из i18n.
const TAB_KEYS = ['services', 'portfolio', 'reviews', 'about', 'partners'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS_BY_LANG: Record<Lang, Record<TabKey, string>> = {
  uk: { services: 'Послуги', portfolio: 'Роботи', reviews: 'Відгуки', about: 'Адреса', partners: 'Рекомендую' },
  ru: { services: 'Услуги', portfolio: 'Работы', reviews: 'Отзывы', about: 'Адрес', partners: 'Рекомендую' },
  en: { services: 'Services', portfolio: 'Portfolio', reviews: 'Reviews', about: 'Address', partners: 'Recommends' },
};

const STR_BY_LANG: Record<Lang, {
  noSchedule: string; dayOff: string; openTill: (t: string) => string; opensAt: (t: string) => string; closed: string;
  follow: string; following: string;
  workHours: string; routeTo: string; reviewsCount: (n: number) => string;
  notFound: string; back: string; book: string; servicesCount: (n: number) => string;
  recommendTitle: string; recommendDesc: string; portfolioTitle: string;
  reviewsTitle: string; addressTitle: string; servicesTitle: string;
  metricClients: string; metricBookings: string; metricReviews: string;
}> = {
  uk: {
    noSchedule: 'Графіка немає', dayOff: 'Сьогодні вихідний',
    openTill: (t) => `Відкрито до ${t}`, opensAt: (t) => `Відкриється о ${t}`, closed: 'Зачинено',
    follow: 'Підписатися', following: 'Ви підписані',
    workHours: 'Години роботи', routeTo: 'Маршрут', reviewsCount: (n) => n === 1 ? '1 відгук' : `${n} відгуків`,
    notFound: 'Майстра не знайдено', back: 'Назад', book: 'Записатися',
    servicesCount: (n) => n === 1 ? 'послуга' : (n < 5 ? 'послуги' : 'послуг'),
    recommendTitle: 'Рекомендую', recommendDesc: 'Майстри, з якими я працюю і кому довіряю.',
    portfolioTitle: 'Роботи', reviewsTitle: 'Відгуки', addressTitle: 'Адреса', servicesTitle: 'Послуги',
    metricClients: 'клієнти', metricBookings: 'записи', metricReviews: 'відгуки',
  },
  ru: {
    noSchedule: 'Нет расписания', dayOff: 'Сегодня выходной',
    openTill: (t) => `Открыто до ${t}`, opensAt: (t) => `Откроется в ${t}`, closed: 'Закрыто',
    follow: 'Подписаться', following: 'Вы подписаны',
    workHours: 'Часы работы', routeTo: 'Маршрут', reviewsCount: (n) => n === 1 ? '1 отзыв' : `${n} отзывов`,
    notFound: 'Мастер не найден', back: 'Назад', book: 'Записаться',
    servicesCount: (n) => n === 1 ? 'услуга' : (n < 5 ? 'услуги' : 'услуг'),
    recommendTitle: 'Рекомендую', recommendDesc: 'Мастера, с которыми я работаю и кому доверяю.',
    portfolioTitle: 'Работы', reviewsTitle: 'Отзывы', addressTitle: 'Адрес', servicesTitle: 'Услуги',
    metricClients: 'клиенты', metricBookings: 'записи', metricReviews: 'отзывы',
  },
  en: {
    noSchedule: 'No schedule', dayOff: 'Closed today',
    openTill: (t) => `Open until ${t}`, opensAt: (t) => `Opens at ${t}`, closed: 'Closed',
    follow: 'Follow', following: 'Following',
    workHours: 'Hours', routeTo: 'Get directions', reviewsCount: (n) => n === 1 ? '1 review' : `${n} reviews`,
    notFound: 'Master not found', back: 'Back', book: 'Book',
    servicesCount: () => 'services',
    recommendTitle: 'Recommends', recommendDesc: 'Masters I work with and trust.',
    portfolioTitle: 'Portfolio', reviewsTitle: 'Reviews', addressTitle: 'Address', servicesTitle: 'Services',
    metricClients: 'clients', metricBookings: 'bookings', metricReviews: 'reviews',
  },
};

/* ─── helpers ─── */

function getOpenStatus(wh: WorkingHoursMap | null, lang: Lang): { isOpen: boolean; label: string } {
  const t = STR_BY_LANG[lang];
  if (!wh) return { isOpen: false, label: t.noSchedule };
  const now = new Date();
  const dayKey = JS_DAY_TO_KEY[now.getDay()];
  const intervals = getDayIntervals(wh[dayKey]);
  if (intervals.length === 0) return { isOpen: false, label: t.dayOff };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  // Идём по интервалам по возрастанию start. Если сейчас внутри одного —
  // показываем «Открыто до конца этого интервала». Если до первого — показываем
  // когда откроется. Иначе — «Закрыто» (например, между двумя интервалами или
  // после последнего).
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  for (const it of sorted) {
    const [sh, sm] = it.start.split(':').map(Number);
    const [eh, em] = it.end.split(':').map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    if (currentMinutes >= s && currentMinutes < e) {
      return { isOpen: true, label: t.openTill(it.end) };
    }
    if (currentMinutes < s) {
      return { isOpen: false, label: t.opensAt(it.start) };
    }
  }
  return { isOpen: false, label: t.closed };
}

function formatDate(iso: string, lang: Lang): string {
  const localeMap: Record<Lang, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };
  return new Date(iso).toLocaleDateString(localeMap[lang], { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── component ─── */

export default function MiniAppMasterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { haptic } = useTelegram();
  const userId = useAuthStore((s) => s.userId);

  const groupBookingId = sp.get('group_booking_id');
  const groupBookingDate = sp.get('date');
  const bookSuffix = groupBookingId ? `&group_booking_id=${groupBookingId}&date=${groupBookingDate ?? ''}` : '';
  // Mini App locale — для всех подписей (табы, дни, статус, кнопки).
  const lang = useMiniAppLocale();
  const tStr = STR_BY_LANG[lang];
  const tabLabels = TAB_LABELS_BY_LANG[lang];
  const dayNames = DAY_NAMES_BY_LANG[lang];

  const [master, setMaster] = useState<MasterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('services');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [cresIdCopied, setCresIdCopied] = useState(false);

  // Refs for scroll-to-section
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<TabKey, HTMLDivElement | null>>({
    services: null,
    portfolio: null,
    reviews: null,
    partners: null,
    about: null,
  });
  const tabBarRef = useRef<HTMLDivElement>(null);

  /* ─── data fetching ─── */
  useEffect(() => {
    if (!params?.id) return;
    const supabase = createClient();

    (async () => {
      // Parallel fetches
      const [masterRes, portfolioRes, reviewsRes, categoriesRes, partnersRes] = await Promise.all([
        supabase
          .from('masters')
          .select('id, display_name, specialization, bio, city, address, rating, total_reviews, avatar_url, workplace_photo_url, served_clients_count, completed_appointments_count, working_hours, latitude, longitude, slug, invite_code, profile:profiles!masters_profile_id_fkey(first_name, last_name, full_name, avatar_url), services!services_master_id_fkey(id, name, price, currency, duration_minutes, description, color, category_id, is_active)')
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
        // Партнёры мастера — те, кому он рекомендует. Активные двусторонние
        // партнёрства, отсортированные по display_order (Business tier) и
        // дате согласия. Дальше расхлопываем по второй стороне.
        supabase
          .from('master_partnerships')
          .select('master_id, partner_id, display_order, accepted_at')
          .or(`master_id.eq.${params.id},partner_id.eq.${params.id}`)
          .eq('status', 'active')
          .order('display_order', { ascending: true })
          .order('accepted_at', { ascending: false }),
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
        workplace_photo_url: string | null;
        served_clients_count: number | null;
        completed_appointments_count: number | null;
        working_hours: WorkingHoursMap | null;
        latitude: number | null;
        longitude: number | null;
        slug: string | null;
        invite_code: string | null;
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

      // Партнёры — тянем профили второй стороны; имя/аватар читаем из profiles
      // (политика "Anyone can read active masters profiles" разрешает анону).
      const partnerRows = (partnersRes.data ?? []) as Array<{ master_id: string; partner_id: string }>;
      const otherIds = partnerRows.map((r) => (r.master_id === params.id ? r.partner_id : r.master_id));
      let partners: PartnerItem[] = [];
      if (otherIds.length > 0) {
        const { data: pData } = await supabase
          .from('masters')
          .select('id, display_name, specialization, avatar_url, rating, total_reviews, profile:profiles!masters_profile_id_fkey(full_name)')
          .in('id', otherIds)
          .eq('is_active', true);
        const byId = new Map<string, PartnerItem>();
        for (const row of (pData ?? []) as Array<{
          id: string;
          display_name: string | null;
          specialization: string | null;
          avatar_url: string | null;
          rating: number | null;
          total_reviews: number | null;
          profile: { full_name: string | null } | { full_name: string | null }[] | null;
        }>) {
          const pp = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          byId.set(row.id, {
            id: row.id,
            display_name: row.display_name,
            full_name: pp?.full_name ?? null,
            specialization: row.specialization,
            avatar_url: row.avatar_url,
            rating: row.rating,
            total_reviews: row.total_reviews,
          });
        }
        partners = otherIds.map((id) => byId.get(id)).filter((x): x is PartnerItem => !!x);
      }

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
        workplace_photo_url: m.workplace_photo_url ?? null,
        served_clients_count: Number(m.served_clients_count ?? 0),
        completed_appointments_count: Number(m.completed_appointments_count ?? 0),
        full_name: p?.full_name ?? null,
        cresHandle: m.slug ?? m.invite_code ?? null,
        working_hours: m.working_hours,
        latitude: m.latitude ?? null,
        longitude: m.longitude ?? null,
        services: (m.services ?? []).filter((s) => s.is_active),
        categories: (categoriesRes.data ?? []) as ServiceCategory[],
        portfolio: (portfolioRes.data ?? []) as PortfolioItem[],
        reviews,
        partners,
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
    return master ? getOpenStatus(master.working_hours, lang) : { isOpen: false, label: '' };
  }, [master]);

  /* ─── schedule presence: хотя бы у одного дня есть валидный интервал ─── */
  const hasSchedule = useMemo(() => {
    if (!master?.working_hours) return false;
    return DAYS_ORDER.some((d) => getDayIntervals(master.working_hours?.[d]).length > 0);
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
        <p className="text-sm text-neutral-500">{tStr.notFound}</p>
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="mt-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-neutral-800 active:scale-95 transition-transform"
          style={{ minHeight: 44 }}
        >
          {tStr.back}
        </button>
      </motion.div>
    );
  }

  const name = master.display_name ?? master.full_name ?? '—';
  const activeServicesCount = master.services.length;

  // pb-4 (16px) — слой layout уже добавляет padding-bottom 81px под
  // floating bottom-nav. Раньше тут был pb-28 (112px) поверх — клиент
  // видел ~80px белой пустоты между последним блоком и навигацией.
  return (
    <div
      ref={scrollContainerRef}
      className="od-client-master-page relative min-h-screen"
      style={{
        // overflow-x: clip обрезает горизонтальное переполнение, но НЕ создаёт
        // scroll context (как overflow-hidden) — sticky-табы продолжают
        // прилипать к viewport. Иначе табы при скролле «гуляли» — sticky
        // ломался от родительского overflow:hidden.
        overflowX: 'clip',
        // Запас снизу чтобы sticky bottom CTA (~50px высота, поднят на 84px над
        // bottom-nav, плюс safe-area) не закрывал последнюю строку контента
        // (адрес мастера обрезался кнопкой — см. скрин).
        paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* ━━━ HERO BANNER ━━━
          Cover показывает workplace_photo_url (фото места работы) если есть,
          иначе cobalt→teal градиент. Аватар (avatar_url) НЕ используется как
          cover — он живёт в круге ниже. Так клиент видит studio/кабинет, а
          не растянутую фотку лица. */}
      <div ref={heroRef} className="relative h-[170px] overflow-hidden">
        {master.workplace_photo_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={master.workplace_photo_url}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
            {/* Тёмное затемнение снизу — для читаемости top-buttons «назад/
                поделиться» поверх любого фото. */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/35" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, var(--m-accent, #2563eb) 0%, var(--m-accent-hover, #1d4ed8) 100%)' }}
          />
        )}

        {/* Top action row */}
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
          <button
            onClick={handleShare}
            className="flex size-10 items-center justify-center rounded-full bg-white shadow-md active:scale-90 transition-transform"
            aria-label="Поделиться"
          >
            <Share2 className="size-[18px] text-neutral-900" />
          </button>
        </motion.div>
      </div>

      {/* ━━━ INFO SECTION ━━━ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 -mt-12 px-5"
      >
        {/* Avatar — round, centered above name, ring matches page bg */}
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--m-accent)] text-[var(--m-accent-text)] text-3xl font-bold ring-4 ring-white shadow-xl">
          {master.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.avatar_url} alt={name} className="size-full object-cover" />
          ) : (
            <span className="text-white">{name[0]?.toUpperCase() ?? 'M'}</span>
          )}
        </div>

        {/* Name + spec — well below banner */}
        <div className="mt-3">
          <h1 className="text-[22px] font-bold leading-tight text-neutral-900">{name}</h1>
          {master.specialization && (
            <p className="mt-1 text-[13px] text-neutral-500">{master.specialization}</p>
          )}
        </div>

        {/* CRES-CA ID — сразу под именем (по запросу пользователя). Тап
            копирует ссылку на публичную страницу. */}
        {master.cresHandle && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined' || !master.cresHandle) return;
                const url = `${window.location.origin}/m/${master.cresHandle}`;
                navigator.clipboard.writeText(url).then(() => {
                  haptic('selection');
                  setCresIdCopied(true);
                  window.setTimeout(() => setCresIdCopied(false), 1500);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors active:scale-[0.97]"
              style={{
                background: 'var(--m-surface)',
                color: 'var(--m-text-secondary)',
                borderColor: 'var(--m-border)',
              }}
            >
              <span style={{ color: 'var(--m-text-tertiary)' }}>CRES-CA ID:</span>
              <span style={{ fontWeight: 600, color: 'var(--m-text)' }}>{master.cresHandle}</span>
              {cresIdCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </div>
        )}

        {/* Meta row — rating, city, open status only when there is a schedule */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
          {master.rating > 0 && (
            <div className="flex items-center gap-1 text-neutral-800">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{master.rating.toFixed(1)}</span>
              <span className="text-neutral-400">({master.total_reviews})</span>
            </div>
          )}
          {master.city && (
            <div className="flex items-center gap-1 text-neutral-500">
              <MapPin className="size-3" />
              <span className="truncate">{master.city}</span>
            </div>
          )}
          {hasSchedule && (
            <div className={`flex items-center gap-1.5 ${openStatus.isOpen ? 'text-emerald-600' : 'text-neutral-400'}`}>
              <div className={`size-1.5 rounded-full ${openStatus.isOpen ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
              <span className="text-[11px] font-medium">{openStatus.label}</span>
            </div>
          )}
        </div>

        {/* Metrics strip — социальная валидация: сколько клиентов обслужил,
            сколько визитов выполнил, сколько отзывов получил. Показываем
            только если есть хотя бы одна метрика > 0, чтобы новые мастера
            не показывали полосу нулей. */}
        {(master.served_clients_count > 0 || master.completed_appointments_count > 0 || master.total_reviews > 0) && (
          <div
            className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border"
            style={{
              background: 'var(--m-surface)',
              borderColor: 'var(--m-border)',
            }}
          >
            <MetricCell value={master.served_clients_count} label={tStr.metricClients} />
            <MetricCell value={master.completed_appointments_count} label={tStr.metricBookings} divider />
            <MetricCell value={master.total_reviews} label={tStr.metricReviews} divider />
          </div>
        )}

        {/* Bio — поднят ПЕРЕД кнопками, чтобы клиент сначала прочитал кто
            такой мастер, а потом решал «записаться/подписаться». Сворачивается
            до 5 строк с тогглом. */}
        {master.bio && (
          <div className="mt-4">
            <p
              className="whitespace-pre-line text-[14px] leading-relaxed text-neutral-700"
              style={
                bioExpanded
                  ? undefined
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: 5,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
              }
            >
              {master.bio}
            </p>
            {master.bio.length > 250 && (
              <button
                type="button"
                onClick={() => { haptic('light'); setBioExpanded((v) => !v); }}
                className="mt-1 text-[12px] font-semibold text-neutral-900 active:opacity-60"
              >
                {bioExpanded ? 'Свернуть' : 'Раскрыть'}
              </button>
            )}
          </div>
        )}

        {/* Кнопки «Записаться» + «Подписаться» — в строку (две колонки).
            Записаться слева как primary action, Подписаться справа. Темы
            переключаются через --m-text / --m-bg. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              haptic('selection');
              router.push(`/telegram/book?master_id=${master.id}${bookSuffix}`);
            }}
            className="flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors active:scale-[0.98]"
            style={{
              background: 'var(--m-text)',
              color: 'var(--m-bg)',
            }}
          >
            <CalendarCheck className="size-4" />
            {tStr.book}
          </button>
          <button
            onClick={toggleFollow}
            disabled={followBusy}
            className="flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60 active:scale-[0.98]"
            style={{
              background: 'transparent',
              color: 'var(--m-text)',
              borderColor: 'var(--m-border)',
            }}
          >
            {followBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : following ? (
              <>
                <HeartOff className="size-4" />
                {tStr.following}
              </>
            ) : (
              <>
                <Heart className="size-4" />
                {tStr.follow}
              </>
            )}
          </button>
        </div>

      </motion.div>

      {/* ━━━ TAB BAR (sticky) — равномерные колонки flex-1 чтобы все табы
            помещались на узком экране без горизонтального скролла. Раньше был
            overflow-x:auto и rail можно было «двигать» свайпом — пользователь
            это раздражал. */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-30 mt-5 border-b backdrop-blur-xl"
        style={{
          background: 'color-mix(in oklab, var(--m-bg) 92%, transparent)',
          borderColor: 'var(--m-border)',
        }}
      >
        <div className="flex">
          {TAB_KEYS.map((key) => {
            // Hide tabs with no content
            if (key === 'portfolio' && master.portfolio.length === 0) return null;
            if (key === 'reviews' && master.reviews.length === 0) return null;
            if (key === 'partners' && master.partners.length === 0) return null;
            // Hide "Адрес" tab if no schedule AND no address (bio is above)
            if (key === 'about' && !hasSchedule && !master.city && !master.address) return null;

            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => scrollToSection(key)}
                className="relative flex-1 min-w-0 px-1 py-3 text-[12.5px] transition-colors"
                style={{
                  color: isActive ? 'var(--m-text)' : 'var(--m-text-tertiary)',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span className="block truncate">{tabLabels[key]}</span>
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full"
                    style={{ background: 'var(--m-text)' }}
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
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
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
                    <div className="group rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Service name (no color dot — that's master-only metadata) */}
                          <p className="truncate text-[14px] font-semibold text-neutral-900">{s.name}</p>

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
                              router.push(`/telegram/book?master_id=${master.id}&service_id=${s.id}${bookSuffix}`);
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
              {tStr.portfolioTitle}
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
                  {item.caption && item.caption.trim() && (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pt-6 pb-2 text-left"
                      style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0) 100%)',
                      }}
                    >
                      <p className="line-clamp-2 text-[11px] font-medium leading-tight text-white drop-shadow">
                        {item.caption}
                      </p>
                    </div>
                  )}
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
                            <p className="whitespace-pre-line text-[14px] leading-relaxed text-white">{item.caption}</p>
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
              {tStr.reviewsTitle}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                {master.total_reviews}
              </span>
            </h2>

            {/* Rating summary */}
            <div className="mb-4 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
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
                <p className="mt-1 text-[10px] text-neutral-400">{tStr.reviewsCount(master.total_reviews)}</p>
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
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-neutral-600">
                        {(r.reviewer_name ?? 'К')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-neutral-900">{r.reviewer_name ?? 'Клиент'}</p>
                        <p className="text-[10px] text-neutral-400">{formatDate(r.created_at, lang)}</p>
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

        {/* ── Contacts (hours + address) ── */}
        {(hasSchedule || master.city || master.address) && (
        <div
          ref={(el) => { sectionRefs.current.about = el; }}
          data-section="about"
        >
          {/* Bio is shown above (under the avatar) — no need to duplicate here.
              This section keeps just hours + address as a compact contact block. */}

          {/* Working hours — only render if at least one day has a schedule */}
          {hasSchedule && (
            <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-neutral-800">{tStr.workHours}</h3>
              <ul className="space-y-2">
                {DAYS_ORDER.map((day) => {
                  const intervals = getDayIntervals(master.working_hours?.[day]);
                  if (intervals.length === 0) return null;
                  const isToday = day === todayKey;
                  // Несколько интервалов в день показываем через запятую:
                  // «10:00 — 13:00, 14:00 — 19:00».
                  const label = intervals
                    .map((iv) => `${iv.start} — ${iv.end}`)
                    .join(', ');
                  return (
                    <li
                      key={day}
                      className={`flex items-center justify-between text-[12px] ${
                        isToday ? 'font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="size-2 rounded-full bg-emerald-500" />
                        <span className={isToday ? 'text-neutral-900' : 'text-neutral-600'}>
                          {dayNames[day]}
                        </span>
                      </div>
                      <span className={isToday ? 'text-neutral-900 font-bold' : 'text-neutral-700 font-medium'}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Address */}
          {(master.city || master.address) && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
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
                      className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--m-accent)] active:text-[var(--m-accent-hover)] transition-colors"
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
        )}

        {/* ── Partners / «Рекомендую» — последняя секция (после адреса). */}
        {master.partners.length > 0 && (
          <div
            ref={(el) => { sectionRefs.current.partners = el; }}
            data-section="partners"
          >
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-neutral-900">
              <Heart className="size-4 text-neutral-500" />
              {tStr.recommendTitle}
            </h2>
            <p className="mb-3 text-[12px] text-neutral-500">
              {tStr.recommendDesc}
            </p>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {master.partners.map((p) => {
                const partnerName = p.display_name ?? p.full_name ?? 'Мастер';
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        haptic('light');
                        router.push(`/telegram/search/${p.id}`);
                      }}
                      className="flex w-full flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-center transition active:scale-[0.97]"
                    >
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatar_url}
                          alt={partnerName}
                          className="size-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100 text-[16px] font-semibold text-neutral-600">
                          {partnerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-[12px] font-semibold leading-tight text-neutral-900">
                        {partnerName}
                      </div>
                      {p.specialization && (
                        <div className="text-[10px] text-neutral-500 leading-tight">{p.specialization}</div>
                      )}
                      {(p.rating ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                          <Star size={10} fill="#f59e0b" color="#f59e0b" />
                          {Number(p.rating).toFixed(1)}
                          <span>({p.total_reviews ?? 0})</span>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* ━━━ STICKY BOTTOM BAR ━━━ */}
      <AnimatePresence>
        {showBottomBar && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 z-40 border-t backdrop-blur-xl"
            style={{
              // 84px = высота floating-pill nav (~64px) + 20px gap. Иначе бар
              // прятался ПОД клиентским bottom-nav (см. скриншот пользователя).
              bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
              background: 'color-mix(in oklab, var(--m-bg) 92%, transparent)',
              borderColor: 'var(--m-border)',
            }}
          >
            <div className="flex items-center justify-between px-5 py-3">
              <div className="text-[13px]" style={{ color: 'var(--m-text-secondary)' }}>
                <span className="font-semibold" style={{ color: 'var(--m-text)' }}>{activeServicesCount}</span>{' '}
                {tStr.servicesCount(activeServicesCount)}
              </div>
              <button
                onClick={() => {
                  haptic('selection');
                  router.push(`/telegram/book?master_id=${master.id}${bookSuffix}`);
                }}
                className="flex items-center gap-2 rounded-2xl px-6 py-2.5 text-[14px] font-semibold active:scale-[0.97] transition-transform shadow-lg"
                style={{
                  background: 'var(--m-text)',
                  color: 'var(--m-bg)',
                }}
              >
                <CalendarCheck className="size-4" />
                {tStr.book}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCell({ value, label, divider }: { value: number; label: string; divider?: boolean }) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K` : String(value);
  return (
    <div
      className="flex flex-col items-center justify-center px-2 py-3"
      style={divider ? { borderLeft: '1px solid var(--m-border)' } : undefined}
    >
      <span className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--m-text)' }}>
        {formatted}
      </span>
      <span className="mt-0.5 text-[10px] font-medium" style={{ color: 'var(--m-text-tertiary)' }}>
        {label}
      </span>
    </div>
  );
}
