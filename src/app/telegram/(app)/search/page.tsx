/** --- YAML
 * name: MiniAppSearchPage
 * description: Mini App unified search — list/map toggle, фильтры в BottomSheet,
 *              salon-aware карточки (CRES-CA-CLIENT-PATCH), Telegram LocationManager.
 * created: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Navigation,
  Loader2,
  Star,
  ChevronRight,
  X,
  List,
  Map as MapIcon,
  SlidersHorizontal,
  Building2,
  User as UserIcon,
  Scissors,
  Home as HomeIcon,
  Car,
  Dumbbell,
  PawPrint,
  Activity as ActivityIcon,
  LayoutGrid,
  MoreHorizontal,
} from 'lucide-react';
import { getLocation } from '@/lib/telegram/geolocation';
import { composeAddress } from '@/lib/format/address';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { MapMarker, SalonMarker } from '@/components/shared/map-view';
import { BottomSheet } from '@/components/shared/primitives/bottom-sheet';
import {
  resolveCardDisplay,
  type MasterRef,
  type SalonRef,
} from '@/lib/client/display-mode';
import { Bot, ArrowDown } from 'lucide-react';
import '@/styles/od-client-mini-app.css';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, FONT_BASE } from '@/components/miniapp/design';
import { AvatarCircle } from '@/components/miniapp/shells';
import { AIChatSheet } from '@/components/miniapp/ai-chat-sheet';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { csGet, csSet } from '@/lib/miniapp/cloud-storage';
import { CATEGORY_TO_VERTICAL } from '@/lib/search/category-vertical';

const MapView = dynamic(() => import('@/components/shared/map-view'), { ssr: false });

const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234];

const MINIAPP_CARD_LABELS = {
  masterPlaceholder: 'Мастер',
  salonPlaceholder: 'Салон',
  managerAssigned: 'Мастер будет назначен администратором',
};

type Lang = 'uk' | 'ru' | 'en';

// Локализованные категории и рейтинговые опции. Keys остаются стабильными
// (используются в логике фильтрации), меняются только подписи.
const CATEGORY_KEYS = ['all', 'beauty', 'health', 'home', 'auto', 'fitness', 'petCare'] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_LABELS: Record<Lang, Record<CategoryKey, string>> = {
  uk: { all: 'Усі', beauty: 'Краса', health: "Здоров'я", home: 'Дім', auto: 'Авто', fitness: 'Фітнес', petCare: 'Тварини' },
  ru: { all: 'Все', beauty: 'Красота', health: 'Здоровье', home: 'Дом', auto: 'Авто', fitness: 'Фитнес', petCare: 'Питомцы' },
  en: { all: 'All', beauty: 'Beauty', health: 'Health', home: 'Home', auto: 'Auto', fitness: 'Fitness', petCare: 'Pets' },
};

const RATING_OPTS = [
  { v: 0, key: 'any' },
  { v: 4, key: '4.0+' },
  { v: 4.5, key: '4.5+' },
] as const;

const RATING_LABELS: Record<Lang, Record<string, string>> = {
  uk: { 'any': 'Будь-який', '4.0+': '4.0+', '4.5+': '4.5+' },
  ru: { 'any': 'Любой', '4.0+': '4.0+', '4.5+': '4.5+' },
  en: { 'any': 'Any', '4.0+': '4.0+', '4.5+': '4.5+' },
};

const FILTER_LABELS: Record<Lang, { title: string; category: string; rating: string; price: string; priceAny: string; sortBy: string; sortDefault: string; sortDistance: string; popular: string; reset: string; apply: string; placeholder: string; filtersAria: string }> = {
  uk: { title: 'Фільтри', category: 'Категорія', rating: 'Рейтинг', price: 'Ціна (до)', priceAny: 'Будь-яка', sortBy: 'Сортування', sortDefault: 'За умовчанням', sortDistance: 'Поруч зі мною', popular: 'Популярне в категорії', reset: 'Скинути', apply: 'Показати', placeholder: 'Майстер, послуга, салон…', filtersAria: 'Фільтри' },
  ru: { title: 'Фильтры', category: 'Категория', rating: 'Рейтинг', price: 'Цена (до)', priceAny: 'Любая', sortBy: 'Сортировка', sortDefault: 'По умолчанию', sortDistance: 'Рядом со мной', popular: 'Популярное в категории', reset: 'Сбросить', apply: 'Показать', placeholder: 'Мастер, услуга, салон…', filtersAria: 'Фильтры' },
  en: { title: 'Filters', category: 'Category', rating: 'Rating', price: 'Price (max)', priceAny: 'Any', sortBy: 'Sort by', sortDefault: 'Default', sortDistance: 'Near me', popular: 'Popular in category', reset: 'Reset', apply: 'Show', placeholder: 'Master, service, salon…', filtersAria: 'Filters' },
};

const VIEW_LABELS: Record<Lang, { list: string; map: string; route: string }> = {
  uk: { list: 'Список', map: 'Карта', route: '🗺 Маршрут до майстра' },
  ru: { list: 'Список', map: 'Карта', route: '🗺 Маршрут к мастеру' },
  en: { list: 'List', map: 'Map', route: '🗺 Route to master' },
};

// Заголовки страницы и блока «Майстри поруч» — текст из прототипа.
const PAGE_LABELS: Record<Lang, { title: string; nearby: string }> = {
  uk: { title: 'Знайти', nearby: 'Майстри поруч' },
  ru: { title: 'Найти', nearby: 'Мастера рядом' },
  en: { title: 'Search', nearby: 'Masters nearby' },
};

// Быстрые чипы поверх результатов — тап подставляет в строку поиска.
// Первый «Усі» сбрасывает запрос и категорию.
const QUICK_CHIPS: Record<Lang, readonly string[]> = {
  uk: ['Усі', 'Стрижка', 'Манікюр', 'Косметолог', 'Масаж', 'Брови'],
  ru: ['Все', 'Стрижка', 'Маникюр', 'Косметолог', 'Массаж', 'Брови'],
  en: ['All', 'Haircut', 'Manicure', 'Skincare', 'Massage', 'Brows'],
};

// Большая cat-grid 4×2 — иконки + подписи. Последний пункт «Інше» открывает фильтры.
const CAT_TILES: ReadonlyArray<{ key: CategoryKey | 'more'; icon: typeof LayoutGrid }> = [
  { key: 'all', icon: LayoutGrid },
  { key: 'beauty', icon: Scissors },
  { key: 'health', icon: ActivityIcon },
  { key: 'home', icon: HomeIcon },
  { key: 'auto', icon: Car },
  { key: 'fitness', icon: Dumbbell },
  { key: 'petCare', icon: PawPrint },
  { key: 'more', icon: MoreHorizontal },
];

const CARD_LABELS: Record<Lang, { add: string; added: string }> = {
  uk: { add: '+ У контакти', added: '✓ У контактах' },
  ru: { add: '+ В контакты', added: '✓ В контактах' },
  en: { add: '+ Add', added: '✓ Added' },
};

interface ApiMasterRow {
  id: string;
  specialization: string | null;
  rating: number | null;
  salon_id: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  workplace_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
  services: { price: number }[] | null;
  salon:
    | { id: string; name: string | null; logo_url: string | null; city: string | null; rating: number | null }
    | { id: string; name: string | null; logo_url: string | null; city: string | null; rating: number | null }[]
    | null;
}

interface ApiSalonRow {
  id: string;
  name: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface NormMaster {
  id: string;
  displayName: string;
  fullName: string | null;
  specialization: string | null;
  rating: number;
  avatar: string | null;
  priceFrom: number | null;
  salonId: string | null;
  lat: number | null;
  lng: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  workplace: string | null;
  salon: { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null } | null;
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function normalizeMaster(row: ApiMasterRow): NormMaster {
  const p = unwrap(row.profile);
  const salon = unwrap(row.salon);
  const prices = (row.services ?? []).map((s) => Number(s.price)).filter((n) => n > 0);
  const priceFrom = prices.length > 0 ? Math.min(...prices) : null;
  return {
    id: row.id,
    displayName: row.display_name ?? p?.full_name ?? 'Мастер',
    fullName: p?.full_name ?? null,
    specialization: row.specialization,
    rating: Number(row.rating ?? 0),
    avatar: row.avatar_url,
    priceFrom,
    salonId: row.salon_id,
    lat: row.latitude,
    lng: row.longitude,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    city: row.city,
    workplace: row.workplace_name,
    salon: salon
      ? {
          id: salon.id,
          name: salon.name ?? '',
          logo_url: salon.logo_url,
          city: salon.city,
          rating: salon.rating,
        }
      : null,
  };
}

function toMasterRef(m: NormMaster): MasterRef {
  return {
    id: m.id,
    display_name: m.displayName,
    full_name: m.fullName,
    specialization: m.specialization,
    avatar_url: m.avatar,
    rating: m.rating,
    salon_id: m.salonId,
  };
}

function toSalonRef(s: NormMaster['salon']): SalonRef | null {
  if (!s) return null;
  return { id: s.id, name: s.name, logo_url: s.logo_url, city: s.city, rating: s.rating };
}

export default function MiniAppSearchPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { haptic } = useTelegram();

  // Локаль Mini App — для подписей фильтров и категорий.
  const lang = useMiniAppLocale();
  const tFilter = FILTER_LABELS[lang];
  const catLabels = CATEGORY_LABELS[lang];
  const ratingLabels = RATING_LABELS[lang];
  const tView = VIEW_LABELS[lang];

  const groupBookingId = sp.get('group_booking_id');
  const groupBookingDate = sp.get('date');

  const [view, setView] = useState<'list' | 'map'>(sp.get('view') === 'map' ? 'map' : 'list');
  // Pre-fill query из URL (например когда тапнули категорию на Главной → /telegram/search?q=Маникюр)
  const [query, setQuery] = useState(() => sp.get('q') ?? '');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [minRating, setMinRating] = useState<0 | 4 | 4.5>(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'default' | 'distance'>('default');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  const [masters, setMasters] = useState<NormMaster[]>([]);
  const [salons, setSalons] = useState<ApiSalonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NormMaster | null>(null);
  const [popularSpecs, setPopularSpecs] = useState<string[]>([]);

  // AI consierge state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);

  // Follow state — what user already added to contacts (mastersById, salonsById)
  const [followedMasters, setFollowedMasters] = useState<Set<string>>(new Set());
  const [followedSalons, setFollowedSalons] = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy] = useState<Set<string>>(new Set());

  // Restore last-used filters from CloudStorage on mount
  useEffect(() => {
    csGet('search:filters').then((raw) => {
      if (!raw) return;
      try {
        const f = JSON.parse(raw) as { category?: string; minRating?: number; maxPrice?: number | null; sortBy?: string };
        if (f.category && ['all', 'nails', 'hair', 'brows', 'lashes', 'massage', 'skin', 'barber', 'makeup', 'other'].includes(f.category)) {
          setCategory(f.category as CategoryKey);
        }
        if (f.minRating === 4 || f.minRating === 4.5) setMinRating(f.minRating);
        if (typeof f.maxPrice === 'number' || f.maxPrice === null) setMaxPrice(f.maxPrice ?? null);
        if (f.sortBy === 'distance') setSortBy('distance');
      } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filters to CloudStorage whenever they change
  useEffect(() => {
    csSet('search:filters', JSON.stringify({ category, minRating, maxPrice, sortBy }));
  }, [category, minRating, maxPrice, sortBy]);

  const centerRef = useRef(center);
  centerRef.current = center;

  const fetchData = useCallback(async (searchQuery?: string, lat?: number, lng?: number, verticalKey?: string | null) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = searchQuery ? { q: searchQuery } : { lat, lng };
      if (verticalKey) body.vertical = verticalKey;
      const res = await fetch('/api/telegram/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setLoading(false); return; }
      const json = (await res.json()) as { masters?: ApiMasterRow[]; salons?: ApiSalonRow[] };
      const normMasters = (json.masters ?? []).map(normalizeMaster);
      const newSalons = json.salons ?? [];
      setMasters(normMasters);
      setSalons(newSalons);

      // Load follow state for these results
      try {
        const masterIds = normMasters.map((m) => m.id);
        const salonIds = newSalons.map((s) => s.id);
        if (masterIds.length || salonIds.length) {
          const sb = createBrowserClient();
          const { data: { user } } = await sb.auth.getUser();
          if (user) {
            if (masterIds.length) {
              const { data } = await sb.from('client_master_links')
                .select('master_id')
                .eq('profile_id', user.id)
                .in('master_id', masterIds);
              setFollowedMasters((s) => {
                const n = new Set(s);
                for (const r of (data ?? []) as Array<{ master_id: string }>) n.add(r.master_id);
                return n;
              });
            }
            if (salonIds.length) {
              const { data } = await sb.from('salon_follows')
                .select('salon_id')
                .eq('profile_id', user.id)
                .in('salon_id', salonIds);
              setFollowedSalons((s) => {
                const n = new Set(s);
                for (const r of (data ?? []) as Array<{ salon_id: string }>) n.add(r.salon_id);
                return n;
              });
            }
          }
        }
      } catch { /* non-fatal */ }
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleFollowMaster(masterId: string) {
    if (followBusy.has(masterId)) return;
    haptic('selection');
    setFollowBusy((s) => new Set(s).add(masterId));
    try {
      const res = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId }),
      });
      if (res.ok) {
        const j = (await res.json()) as { following: boolean };
        setFollowedMasters((s) => {
          const n = new Set(s);
          if (j.following) n.add(masterId); else n.delete(masterId);
          return n;
        });
      }
    } finally {
      setFollowBusy((s) => { const n = new Set(s); n.delete(masterId); return n; });
    }
  }

  async function toggleFollowSalon(salonId: string) {
    if (followBusy.has(salonId)) return;
    haptic('selection');
    setFollowBusy((s) => new Set(s).add(salonId));
    try {
      const isFollowing = followedSalons.has(salonId);
      const res = await fetch(`/api/salon/${salonId}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const j = (await res.json()) as { following: boolean };
        setFollowedSalons((s) => {
          const n = new Set(s);
          if (j.following) n.add(salonId); else n.delete(salonId);
          return n;
        });
      }
    } finally {
      setFollowBusy((s) => { const n = new Set(s); n.delete(salonId); return n; });
    }
  }

  const locate = useCallback(
    async (interactive: boolean) => {
      setGeoBusy(true);
      if (interactive) haptic('light');
      try {
        try {
          const pos = await getLocation();
          if (pos) {
            const coords: [number, number] = [pos.lat, pos.lng];
            setCenter(coords);
            setUserLocation(coords);
            setGeoDenied(false);
            await fetchData(undefined, pos.lat, pos.lng, CATEGORY_TO_VERTICAL[category]);
            if (interactive) haptic('success');
            return;
          }
        } catch {
          /* try IP */
        }

        const ipServices = [
          async () => {
            const r = await fetch('https://ipwho.is/', { cache: 'no-store' });
            const j = await r.json();
            return typeof j.latitude === 'number' && typeof j.longitude === 'number'
              ? { lat: j.latitude, lng: j.longitude }
              : null;
          },
          async () => {
            const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
            const j = await r.json();
            return typeof j.latitude === 'number' && typeof j.longitude === 'number'
              ? { lat: j.latitude, lng: j.longitude }
              : null;
          },
        ];

        for (const svc of ipServices) {
          try {
            const r = await svc();
            if (r) {
              const coords: [number, number] = [r.lat, r.lng];
              setCenter(coords);
              setUserLocation(coords);
              setGeoDenied(true);
              await fetchData(undefined, r.lat, r.lng, CATEGORY_TO_VERTICAL[category]);
              return;
            }
          } catch {
            /* next */
          }
        }

        setGeoDenied(true);
        await fetchData(undefined, DEFAULT_CENTER[0], DEFAULT_CENTER[1], CATEGORY_TO_VERTICAL[category]);
      } finally {
        setGeoBusy(false);
      }
    },
    [fetchData, haptic],
  );

  useEffect(() => {
    locate(false);
  }, [locate]);

  // Debounced name search + category. Любая смена query или category триггерит
  // новый запрос на сервер — раньше category фильтровалась только на клиенте
  // по уже подгруженным 30 строкам, что упускало мастеров другой категории
  // если они не вошли в первый батч.
  useEffect(() => {
    const trimmed = query.trim();
    const v = CATEGORY_TO_VERTICAL[category];
    if (trimmed.length === 0) {
      if (!loading) fetchData(undefined, centerRef.current[0], centerRef.current[1], v);
      return;
    }
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => fetchData(trimmed, undefined, undefined, v), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  // Подсказки популярных специализаций для выбранной ниши («Маникюр / Брови …»
  // под Категорией = Красота). Грузятся из общей таблицы vertical_specializations.
  useEffect(() => {
    const v = CATEGORY_TO_VERTICAL[category];
    if (!v) {
      setPopularSpecs([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/search/popular-specs?vertical=${v}&limit=12`)
      .then((r) => (r.ok ? r.json() : { specs: [] }))
      .then((j: { specs?: string[] }) => {
        if (!cancelled) setPopularSpecs(Array.isArray(j.specs) ? j.specs : []);
      })
      .catch(() => { if (!cancelled) setPopularSpecs([]); });
    return () => { cancelled = true; };
  }, [category]);

  // Client-side filter by rating/price + optional distance sort.
  // Категория уже отфильтрована сервером (по vertical-колонке + ilike-fallback),
  // поэтому здесь её не дублируем.
  const filteredMasters = useMemo(() => {
    let result = masters.filter((m) => {
      if (minRating > 0 && m.rating < minRating) return false;
      if (maxPrice !== null && m.priceFrom !== null && m.priceFrom > maxPrice) return false;
      return true;
    });
    if (sortBy === 'distance' && userLocation) {
      const [ulat, ulng] = userLocation;
      result = [...result].sort((a, b) => {
        const da = a.lat !== null && a.lng !== null
          ? Math.hypot(a.lat - ulat, a.lng - ulng) : Infinity;
        const db = b.lat !== null && b.lng !== null
          ? Math.hypot(b.lat - ulat, b.lng - ulng) : Infinity;
        return da - db;
      });
    }
    return result;
  }, [masters, minRating, maxPrice, sortBy, userLocation]);

  const filteredSalons = useMemo(() => {
    return salons.filter((s) => {
      if (minRating > 0 && (Number(s.rating ?? 0)) < minRating) return false;
      return true;
    });
  }, [salons, minRating]);

  const markers: MapMarker[] = useMemo(
    () =>
      filteredMasters
        .filter((m) => m.lat != null && m.lng != null)
        .map((m) => ({
          lat: m.lat!,
          lng: m.lng!,
          name: m.displayName,
          rating: m.rating,
          specialization: m.specialization ?? undefined,
          address: composeAddress(m.workplace, m.address, m.city) || undefined,
          masterId: m.id,
        })),
    [filteredMasters],
  );

  const salonMarkers: SalonMarker[] = useMemo(
    () =>
      filteredSalons
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          lat: s.latitude!,
          lng: s.longitude!,
          name: s.name ?? 'Салон',
          address: s.address ?? undefined,
          salonId: s.id,
        })),
    [filteredSalons],
  );

  const activeFilters = (category !== 'all' ? 1 : 0) + (minRating > 0 ? 1 : 0) + (maxPrice !== null ? 1 : 0) + (sortBy !== 'default' ? 1 : 0);
  const total = filteredMasters.length + filteredSalons.length;

  return (
    <div
      className="od-client-mini-app"
      style={{
        ...FONT_BASE,
        display: 'flex',
        flexDirection: 'column',
        // height на map-view нужен FIX'енный, чтобы flex:1 у блока с картой
        // получил конкретное число и Leaflet смог себя растянуть.
        // Раньше было `100dvh` — но <main> снаружи имеет padding-bottom
        // 81px (под floating bottom-nav) + tg-safe-area. В сумме страница
        // получалась выше viewport на эти 81px и под картой появлялось
        // пустое белое пространство (см. скрин Данила 2026-05-06).
        // Вычитаем эти отступы:
        height: view === 'map'
          ? 'calc(100dvh - 81px - env(safe-area-inset-bottom, 0px) - var(--tg-content-top, 0px))'
          : 'auto',
        minHeight: undefined,
        background: T.bg,
        color: T.text,
      }}
    >
      {/* Top controls — структура из прототипа: title + search-bar + chips + cat-grid + nearby header */}
      {/* Page title «Знайти» */}
      <div className="page-title">{PAGE_LABELS[lang].title}</div>

      {/* Search bar — литеральный .search-bar класс прототипа.
          Иконка слева, инпут, AI-кнопка (или крестик когда есть текст), фильтр-иконка. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 16px' }}>
        <div className="search-bar" style={{ flex: 1, margin: 0 }}>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tFilter.placeholder}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: T.text,
              fontFamily: 'inherit',
              minWidth: 0,
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => { haptic('light'); setQuery(''); }}
              aria-label="clear"
              style={{ background: 'transparent', border: 'none', color: T.textTertiary, cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={18} />
            </button>
          ) : (
            <div
              role="button"
              tabIndex={0}
              className="search-ai"
              onClick={(e) => { e.stopPropagation(); haptic('light'); setAiPrompt(null); setAiOpen(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setAiPrompt(null); setAiOpen(true); } }}
              aria-label="AI-консьерж"
            >
              <Bot />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { haptic('light'); setFiltersOpen(true); }}
          className="btn-icon"
          style={{ position: 'relative', width: 48, height: 48, background: T.surface, border: `1px solid ${T.border}` }}
          aria-label={tFilter.filtersAria}
        >
          <SlidersHorizontal size={20} color={T.text} strokeWidth={2} />
          {activeFilters > 0 && (
            <span
              style={{
                position: 'absolute', top: -2, right: -2,
                width: 18, height: 18, borderRadius: '50%',
                background: T.accent, color: '#fff',
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Quick chips — тап на «Усі» сбрасывает запрос, остальные подставляют в строку поиска */}
      <div className="chips-row">
        {QUICK_CHIPS[lang].map((label, idx) => {
          const isAllChip = idx === 0;
          const active = isAllChip ? query.trim() === '' : query.trim() === label;
          return (
            <button
              key={label}
              type="button"
              className={`chip${active ? ' active' : ''}`}
              onClick={() => { haptic('selection'); setQuery(isAllChip ? '' : label); }}
            >
              {isAllChip && <LayoutGrid />}
              {label}
            </button>
          );
        })}
      </div>

      {/* Category grid — 4×2 иконок. Тап на «Інше» (more) открывает фильтры. */}
      <div className="cat-grid">
        {CAT_TILES.map(({ key, icon: Icon }) => {
          const isMore = key === 'more';
          const active = !isMore && category === key;
          const label = isMore
            ? (lang === 'uk' ? 'Інше' : lang === 'en' ? 'More' : 'Другое')
            : catLabels[key];
          return (
            <button
              key={key}
              type="button"
              className={`cat-item${active ? ' active' : ''}`}
              onClick={() => {
                haptic('selection');
                if (isMore) { setFiltersOpen(true); return; }
                setCategory(key);
              }}
            >
              <span className="cat-icon"><Icon /></span>
              <span className="cat-label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Section header «Майстри поруч» + list/map .btn-icon toggle + geolocate btn */}
      <div className="flex items-center justify-between" style={{ padding: '4px 16px 10px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>
          {PAGE_LABELS[lang].nearby}
          {!loading && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: T.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
              {total}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['list', 'map'] as const).map((mode) => {
            const Icon = mode === 'list' ? List : MapIcon;
            const active = view === mode;
            return (
              <button
                key={mode}
                type="button"
                className="btn-icon"
                onClick={() => { haptic('selection'); setView(mode); }}
                style={active ? { background: T.accentSoft, color: T.accent } : undefined}
                aria-label={mode === 'list' ? tView.list : tView.map}
              >
                <Icon />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => locate(true)}
            disabled={geoBusy}
            className="btn-icon"
            style={{ cursor: geoBusy ? 'wait' : 'pointer', opacity: geoBusy ? 0.6 : 1 }}
            aria-label="Моя геолокация"
          >
            {geoBusy ? <Loader2 className="animate-spin" /> : <Navigation />}
          </button>
        </div>

        {geoDenied && !geoBusy && (
          <p style={{ ...TYPE.micro, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowDown size={11} /> Включите геолокацию, чтобы видеть мастеров рядом
          </p>
        )}
      </div>

      {/* Results body */}
      {view === 'list' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: `8px ${PAGE_PADDING_X}px 24px` }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
            </div>
          ) : total === 0 && query.trim().length > 0 ? (
            // Empty state ПОСЛЕ ввода запроса — нет совпадений
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '64px 0' }}>
              <Search size={36} color={T.textTertiary} style={{ opacity: 0.4 }} />
              <p style={{ ...TYPE.bodyStrong, color: T.text, marginTop: 12 }}>Ничего не найдено</p>
              <p style={{ ...TYPE.caption, marginTop: 4 }}>Попробуйте изменить запрос или фильтры</p>
            </div>
          ) : total === 0 ? (
            // Пусто на старте — категории и быстрые чипы уже над списком,
            // здесь только короткая подсказка (cat-grid сам играет роль landing).
            <div className="empty-state">
              <Search />
              <p>
                {lang === 'uk' ? 'Оберіть категорію' : lang === 'en' ? 'Pick a category' : 'Выберите категорию'}
              </p>
              <span>
                {lang === 'uk'
                  ? 'Або введіть назву послуги чи майстра'
                  : lang === 'en'
                    ? 'Or type a service or master name'
                    : 'Или введите услугу/имя мастера'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnimatePresence mode="popLayout">
                {filteredMasters.map((m, i) => (
                  <motion.div
                    key={`m-${m.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.02, 0.15) } }}
                    exit={{ opacity: 0, scale: 0.97 }}
                  >
                    <MiniResultCard
                      master={toMasterRef(m)}
                      salon={toSalonRef(m.salon)}
                      onClick={() => { haptic('selection'); router.push(`/telegram/search/${m.id}${groupBookingId ? `?group_booking_id=${groupBookingId}&date=${groupBookingDate ?? ''}` : ''}`); }}
                      isAdded={followedMasters.has(m.id)}
                      addBusy={followBusy.has(m.id)}
                      onAdd={() => toggleFollowMaster(m.id)}
                      labels={CARD_LABELS[lang]}
                    />
                  </motion.div>
                ))}
                {filteredSalons.map((s, i) => (
                  <motion.div
                    key={`s-${s.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min((filteredMasters.length + i) * 0.02, 0.15) } }}
                    exit={{ opacity: 0, scale: 0.97 }}
                  >
                    <MiniResultCard
                      master={null}
                      salon={{
                        id: s.id,
                        name: s.name ?? '',
                        logo_url: s.logo_url,
                        city: s.city,
                        rating: s.rating,
                      }}
                      onClick={() => { haptic('selection'); router.push(`/telegram/salon/${s.id}`); }}
                      isAdded={followedSalons.has(s.id)}
                      addBusy={followBusy.has(s.id)}
                      onAdd={() => toggleFollowSalon(s.id)}
                      labels={CARD_LABELS[lang]}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            margin: `0 ${PAGE_PADDING_X}px 16px`,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            borderRadius: R.lg,
            border: `1px solid ${T.borderSubtle}`,
            boxShadow: SHADOW.card,
            background: T.bgSubtle,
          }}
        >
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)',
            }}>
              <Loader2 size={28} className="animate-spin" color={T.accent} />
            </div>
          )}
          <MapView
            markers={markers}
            salonMarkers={salonMarkers}
            center={center}
            zoom={13}
            className="size-full"
            onMarkerClick={(id) => {
              const m = filteredMasters.find((x) => x.id === id);
              if (m) { setSelected(m); haptic('selection'); }
            }}
            onSalonClick={(id) => { haptic('selection'); router.push(`/telegram/salon/${id}`); }}
            userLocation={userLocation}
          />

          {!loading && (markers.length > 0 || salonMarkers.length > 0) && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                zIndex: 500,
                padding: '6px 12px',
                borderRadius: R.pill,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0,0,0,0.1)',
                fontSize: 12,
                fontWeight: 700,
                color: '#1f1f22',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span title="мастеров">👤 {markers.length}</span>
              {salonMarkers.length > 0 && (
                <span style={{ marginLeft: 8 }} title="команд">🏢 {salonMarkers.length}</span>
              )}
            </div>
          )}

          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  right: 12,
                  zIndex: 600,
                  background: T.surface,
                  border: `1px solid ${T.borderSubtle}`,
                  borderRadius: R.md,
                  boxShadow: SHADOW.elevated,
                  overflow: 'hidden',
                }}
              >
                {(() => {
                  const d = resolveCardDisplay(toMasterRef(selected), toSalonRef(selected.salon), MINIAPP_CARD_LABELS);
                  const Icon = d.mode === 'solo' ? UserIcon : Building2;
                  const fullAddress = composeAddress(selected.workplace, selected.address, selected.city);
                  const mapsUrl = fullAddress
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
                    : (selected.latitude && selected.longitude)
                      ? `https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`
                      : null;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => { haptic('selection'); router.push(`/telegram/search/${selected.id}${groupBookingId ? `?group_booking_id=${groupBookingId}&date=${groupBookingDate ?? ''}` : ''}`); }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: 12,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        <AvatarCircle url={d.avatarSrc} name={d.avatarName} size={56} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon size={13} color={T.textTertiary} />
                            <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.primary}
                            </p>
                          </div>
                          {d.secondary && (
                            <p style={{ ...TYPE.caption, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.secondary}
                            </p>
                          )}
                          {fullAddress && (
                            <p style={{ ...TYPE.caption, marginTop: 4, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                              📍 {fullAddress}
                            </p>
                          )}
                          {d.rating != null && d.rating > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 12, fontWeight: 600 }}>
                              <Star size={12} fill="#f59e0b" color="#f59e0b" />
                              <span style={{ color: T.text }}>{d.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight size={20} color={T.textTertiary} style={{ flexShrink: 0, marginTop: 18 }} />
                      </button>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { e.stopPropagation(); haptic('light'); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '12px 16px',
                            borderTop: `1px solid ${T.borderSubtle}`,
                            background: T.surfaceElevated || T.surface,
                            color: T.accent,
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: 'none',
                            minHeight: 44,
                          }}
                        >
                          {tView.route}
                        </a>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        /* Поднимаем дефолтную высоту до 70% — иначе нижние кнопки
           «Скинути / Показати» обрезались за плавающим bottom-nav и
           клиент не видел способа применить выбор (см. скрин 2026-05-06). */
        snapPoints={[0.7, 0.95]}
        /* Перебиваем shadcn bg-card (тёмный в системной dark) на
           Mini App-токен — чтобы шторка визуально была частью клиентского
           Mini App, а не торчала чёрным блоком на белом фоне. */
        sheetStyle={{
          background: T.bg,
          color: T.text,
          border: `1px solid ${T.borderSubtle}`,
          borderBottom: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            /* +96px снизу чтобы action-кнопки не залезали под floating nav. */
            padding: '4px 0 96px',
            color: T.text,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{tFilter.title}</h3>
            <button
              type="button"
              onClick={() => { haptic('light'); setFiltersOpen(false); }}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                border: 'none',
                background: T.bgSubtle,
                color: T.textSecondary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div>
            <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>{tFilter.category}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORY_KEYS.map((key) => {
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: R.pill,
                      border: `1px solid ${active ? T.text : T.border}`,
                      background: active ? T.text : 'transparent',
                      color: active ? T.bg : T.textSecondary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {catLabels[key]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Popular specializations for the selected category — клик по чипу
              подставляет название в строку поиска и закрывает фильтры. */}
          {popularSpecs.length > 0 && (
            <div>
              <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>{tFilter.popular}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {popularSpecs.map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => {
                      haptic('selection');
                      setQuery(spec);
                      setFiltersOpen(false);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: R.pill,
                      border: `1px solid ${T.borderSubtle}`,
                      background: T.bgSubtle,
                      color: T.text,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>{tFilter.rating}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {RATING_OPTS.map((opt) => {
                const active = minRating === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setMinRating(opt.v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 14px',
                      borderRadius: R.pill,
                      border: `1px solid ${active ? '#f59e0b' : T.border}`,
                      background: active ? '#fef3c7' : 'transparent',
                      color: active ? '#b45309' : T.textSecondary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {opt.v > 0 && <Star size={12} fill="#f59e0b" color="#f59e0b" />}
                    {ratingLabels[opt.key]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price slider */}
          <div>
            <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>{tFilter.price}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={0}
                max={3000}
                step={100}
                value={maxPrice ?? 3000}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxPrice(v >= 3000 ? null : v);
                }}
                style={{ flex: 1, accentColor: T.accent }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 60, textAlign: 'right' }}>
                {maxPrice === null ? tFilter.priceAny : `≤ ${maxPrice}₴`}
              </span>
            </div>
          </div>

          {/* Sort */}
          <div>
            <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>{tFilter.sortBy}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['default', 'distance'] as const).map((opt) => {
                const active = sortBy === opt;
                const label = opt === 'default' ? tFilter.sortDefault : tFilter.sortDistance;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      haptic('selection');
                      if (opt === 'distance' && !userLocation) {
                        locate(true);
                      }
                      setSortBy(opt);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: R.pill,
                      border: `1px solid ${active ? T.text : T.border}`,
                      background: active ? T.text : 'transparent',
                      color: active ? T.bg : T.textSecondary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setMinRating(0);
                setMaxPrice(null);
                setSortBy('default');
              }}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: R.md,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.textSecondary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tFilter.reset}
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setFiltersOpen(false);
              }}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: R.md,
                border: 'none',
                background: T.text,
                color: T.bg,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tFilter.apply} ({total})
            </button>
          </div>
        </div>
      </BottomSheet>

      <AIChatSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialPrompt={aiPrompt}
      />
    </div>
  );
}

/** Лендинг поиска — то что видит клиент когда ничего не введено и нет фильтров.
 *  Категории-чипы по конкретным услугам (тап → подставляет в строку поиска),
 *  плюс крупная кнопка AI-помощника. Без этого экран показывал «Ничего не
 *  найдено» сразу при открытии — выглядело как баг. */
function SearchLanding({ lang, onCategory, onAi }: {
  lang: Lang;
  onCategory: (label: string) => void;
  onAi: () => void;
}) {
  const heading = lang === 'uk'
    ? 'З чого почати'
    : lang === 'en' ? 'Where to start' : 'С чего начать';
  const aiTitle = lang === 'uk'
    ? 'Запитай AI'
    : lang === 'en' ? 'Ask AI' : 'Спроси AI';
  const aiDesc = lang === 'uk'
    ? 'Опиши що шукаєш — підкажемо майстра'
    : lang === 'en' ? 'Describe what you need — we’ll find a master' : 'Опиши что ищешь — подберём мастера';
  const popular = lang === 'uk' ? 'Популярні запити' : lang === 'en' ? 'Popular searches' : 'Популярные запросы';

  // Локализованные названия частых услуг. Тап → подставит в search bar.
  const QUICK: Record<Lang, string[]> = {
    uk: ['Манікюр', 'Стрижка', 'Масаж', 'Брови', 'Стоматолог', 'Косметолог', 'Тату', 'Ветеринар'],
    ru: ['Маникюр', 'Стрижка', 'Массаж', 'Брови', 'Стоматолог', 'Косметолог', 'Тату', 'Ветеринар'],
    en: ['Manicure', 'Haircut', 'Massage', 'Brows', 'Dentist', 'Skincare', 'Tattoo', 'Veterinary'],
  };

  return (
    <div className="od-client-mini-app" style={{ padding: '12px 0 32px' }}>
      <div style={{ padding: '0 16px 12px', fontSize: 17, fontWeight: 700, color: 'var(--m-text, #0f172a)' }}>
        {heading}
      </div>

      {/* AI prompt — feed-card стиль эталона */}
      <div style={{ padding: '0 16px' }}>
        <button
          type="button"
          onClick={onAi}
          className="feed-card"
          style={{ width: '100%', fontFamily: 'inherit', border: '1px solid var(--m-border)', textAlign: 'left' }}
        >
          <div className="fc-icon">
            <Bot size={20} strokeWidth={2.2} />
          </div>
          <div className="fc-info">
            <div className="fc-title">{aiTitle}</div>
            <div className="fc-sub">{aiDesc}</div>
          </div>
          <ChevronRight size={16} color="var(--m-text-tertiary, #94a3b8)" />
        </button>
      </div>

      {/* Quick category chips */}
      <div style={{ padding: '8px 16px 4px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--m-text-tertiary, #94a3b8)',
          margin: '0 0 10px',
        }}>{popular}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {QUICK[lang].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onCategory(label)}
              className="chip"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MiniResultCardProps {
  master: MasterRef | null;
  salon: SalonRef | null;
  onClick: () => void;
  isAdded?: boolean;
  addBusy?: boolean;
  onAdd?: () => void;
  labels: { add: string; added: string };
}

function MiniResultCard({ master, salon, onClick, isAdded, addBusy, onAdd, labels }: MiniResultCardProps) {
  const d = resolveCardDisplay(master, salon, MINIAPP_CARD_LABELS);
  const initials = (d.avatarName || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="od-client-mini-app"
      style={{ cursor: 'pointer' }}
    >
      <div className="master-card" style={{ borderRadius: 16, border: '1px solid var(--m-border, #e2e8f0)', marginBottom: 8 }}>
        <div className="avatar av-md" style={{ flexShrink: 0 }}>
          {d.avatarSrc ? <img src={d.avatarSrc} alt="" /> : initials}
        </div>
        <div className="mc-info">
          <div className="mc-name">{d.primary}</div>
          <div className="mc-meta">
            {d.rating != null && (
              <>
                <Star size={12} fill="#f59e0b" color="#f59e0b" />
                <span>{d.rating.toFixed(1)}</span>
              </>
            )}
            {d.secondary && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.rating != null ? ` · ${d.secondary}` : d.secondary}
              </span>
            )}
          </div>
        </div>
        {onAdd ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!isAdded && !addBusy) onAdd(); }}
            disabled={isAdded || addBusy}
            className="btn btn-sm"
            style={{
              flexShrink: 0,
              background: isAdded ? 'var(--m-bg-subtle, #f2f4f7)' : 'var(--m-accent, #2563eb)',
              color: isAdded ? 'var(--m-text-tertiary, #94a3b8)' : '#fff',
              cursor: isAdded ? 'default' : 'pointer',
              opacity: addBusy ? 0.6 : 1,
              minHeight: 32,
            }}
          >
            {addBusy ? <Loader2 size={12} className="animate-spin" />
              : isAdded ? labels.added
              : labels.add}
          </button>
        ) : (
          <ChevronRight size={18} color="var(--m-text-tertiary, #94a3b8)" />
        )}
      </div>
    </div>
  );
}
