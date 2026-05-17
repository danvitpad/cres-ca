/** --- YAML
 * name: MiniAppSearchPage
 * description: «Пошук» Mini App — визуал из mobile-client/search мокапа.
 *              Top bar + фільтр-іконка, search pill, horizontal filter chips,
 *              toolbar (count + list/map), карточки мастеров в мок-стиле.
 *              Использует /api/telegram/nearby + геолокацию через Telegram/Browser.
 * created: 2026-04-19
 * updated: 2026-05-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Search, SlidersHorizontal, Check, Star, Coins, MapPin, List, Map as MapIcon,
  Loader2, Navigation, Clock, X,
} from 'lucide-react';
import '@/styles/od-client-mini-app.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage } from '@/components/miniapp/shells';
import { getLocation } from '@/lib/telegram/geolocation';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import type { MapMarker } from '@/components/shared/map-view';

const MapView = dynamic(() => import('@/components/shared/map-view'), { ssr: false });

interface ApiMasterRow {
  id: string;
  display_name: string | null;
  full_name?: string | null;
  specialization: string | null;
  rating: number | null;
  total_reviews?: number | null;
  reviews_count?: number | null;
  avatar_url: string | null;
  city: string | null;
  address?: string | null;
  workplace_name?: string | null;
  latitude: number | null;
  longitude: number | null;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
  services?: Array<{ price: number | string | null }> | null;
  salon?: { city: string | null } | { city: string | null }[] | null;
}

interface Master {
  id: string;
  name: string;
  specialization: string | null;
  rating: number;
  reviewsCount: number;
  avatar: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  priceFrom: number | null;
  slots: string[];
  distanceKm: number | null;
}

type Lang = 'uk' | 'ru' | 'en';

const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234];

// Маппинг ключей категорий с home-страницы в поисковые термины.
// API /api/telegram/nearby делает ilike по specialization мастера.
const CATEGORY_TO_TERM: Record<string, string> = {
  hair: 'волос',          // ловит: парикмахер / волосся / hair / стрижка
  nails: 'нігт',          // нігті / манікюр / nails
  face: 'обличч',         // обличчя / лицо / косметолог / face
  massage: 'масаж',
  brows: 'бров',          // брови / brows / eyebrow
  laser: 'лазер',
  skin: 'шкір',           // шкіра / skin / косметолог
  all: '',
};

// Локализованные заголовки страницы по категории (без знача — общий «Пошук»).
const CATEGORY_LABELS: Record<string, Record<'uk' | 'ru' | 'en', string>> = {
  hair:    { uk: 'Волосся',  ru: 'Волосы',    en: 'Hair' },
  nails:   { uk: 'Нігті',    ru: 'Ногти',     en: 'Nails' },
  face:    { uk: 'Обличчя',  ru: 'Лицо',      en: 'Face' },
  massage: { uk: 'Масаж',    ru: 'Массаж',    en: 'Massage' },
  brows:   { uk: 'Брови',    ru: 'Брови',     en: 'Brows' },
  laser:   { uk: 'Лазер',    ru: 'Лазер',     en: 'Laser' },
  skin:    { uk: 'Шкіра',    ru: 'Кожа',      en: 'Skin' },
};

const T_LABELS: Record<Lang, {
  title: string;
  searchHint: string;
  count: (n: number) => string;
  list: string; map: string;
  today: string; rating: string; budget: string; distance: string;
  empty: string; emptyHint: string;
  bookCta: string; slots: string;
  geoHint: string;
}> = {
  uk: {
    title: 'Пошук',
    searchHint: 'Манікюр у Києві сьогодні',
    count: (n) => `${n} ${plural(n, 'uk')}`,
    list: 'Список', map: 'Карта',
    today: 'Сьогодні', rating: '4.5+', budget: 'до ₴500', distance: '3 км',
    empty: 'Нічого не знайшли',
    emptyHint: 'Спробуйте змінити фільтри або запит',
    bookCta: 'Записатись',
    slots: 'Слоти',
    geoHint: 'Увімкніть геопозицію для пошуку поряд',
  },
  ru: {
    title: 'Поиск',
    searchHint: 'Маникюр в Киеве сегодня',
    count: (n) => `${n} ${plural(n, 'ru')}`,
    list: 'Список', map: 'Карта',
    today: 'Сегодня', rating: '4.5+', budget: 'до ₴500', distance: '3 км',
    empty: 'Ничего не нашли',
    emptyHint: 'Попробуйте изменить фильтры или запрос',
    bookCta: 'Записаться',
    slots: 'Слоты',
    geoHint: 'Включите геопозицию для поиска рядом',
  },
  en: {
    title: 'Search',
    searchHint: 'Nails in Kyiv today',
    count: (n) => `${n} ${plural(n, 'en')}`,
    list: 'List', map: 'Map',
    today: 'Today', rating: '4.5+', budget: 'under ₴500', distance: '3 km',
    empty: 'Nothing found',
    emptyHint: 'Try a different filter or query',
    bookCta: 'Book',
    slots: 'Slots',
    geoHint: 'Enable geolocation for nearby search',
  },
};

function plural(n: number, lang: Lang): string {
  if (lang === 'en') return n === 1 ? 'master' : 'masters';
  const m10 = n % 10, m100 = n % 100;
  if (lang === 'uk') {
    if (m10 === 1 && m100 !== 11) return 'майстер';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'майстри';
    return 'майстрів';
  }
  // ru
  if (m10 === 1 && m100 !== 11) return 'мастер';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'мастера';
  return 'мастеров';
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalize(row: ApiMasterRow, userLoc: [number, number] | null): Master {
  const name = row.display_name ?? row.profile?.full_name ?? row.full_name ?? 'Майстер';
  const avatar = row.avatar_url ?? row.profile?.avatar_url ?? null;
  const distance = (userLoc && row.latitude && row.longitude)
    ? haversineKm(userLoc, [row.latitude, row.longitude])
    : null;
  const salonObj = Array.isArray(row.salon) ? row.salon[0] : row.salon;
  // Берём min price из services array (API возвращает services!services_master_id_fkey(price))
  let priceFrom: number | null = null;
  if (Array.isArray(row.services)) {
    for (const s of row.services) {
      if (s.price == null) continue;
      const p = Number(s.price);
      if (!p) continue;
      if (priceFrom == null || p < priceFrom) priceFrom = p;
    }
  }
  return {
    id: row.id,
    name,
    specialization: row.specialization,
    rating: Number(row.rating ?? 0),
    reviewsCount: row.total_reviews ?? row.reviews_count ?? 0,
    avatar,
    city: row.city ?? salonObj?.city ?? row.workplace_name ?? null,
    lat: row.latitude,
    lng: row.longitude,
    priceFrom,
    slots: [],
    distanceKm: distance,
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export default function MiniAppSearchPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];

  const [query, setQuery] = useState(() => sp.get('q') ?? '');
  const [view, setView] = useState<'list' | 'map'>(sp.get('view') === 'map' ? 'map' : 'list');
  // Категория из ?cat=hair|nails|... — переводим в text-search query или vertical.
  // Если cat задан → автоматически фильтруем по нему через API param.
  const cat = sp.get('cat');

  // Filter chips
  const [fToday, setFToday] = useState(false);
  const [fRating, setFRating] = useState(false);
  const [fPrice, setFPrice] = useState(false);
  const [fDistance, setFDistance] = useState(false);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);

  // Geo location on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGeoBusy(true);
      try {
        const pos = await getLocation();
        if (cancelled) return;
        if (pos) {
          setCenter([pos.lat, pos.lng]);
          setUserLocation([pos.lat, pos.lng]);
        } else {
          setGeoDenied(true);
        }
      } catch {
        if (!cancelled) setGeoDenied(true);
      } finally {
        if (!cancelled) setGeoBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchData = useCallback(async (q: string, c: [number, number]) => {
    setLoading(true);
    try {
      // Если задана категория ?cat= — превращаем в text-query для API
      // (API делает ilike по specialization), иначе шлём q или geo.
      const catTerm = cat ? CATEGORY_TO_TERM[cat] ?? null : null;
      const effectiveQuery = q.trim() || catTerm || '';
      const body: Record<string, unknown> = effectiveQuery
        ? { q: effectiveQuery }
        : { lat: c[0], lng: c[1] };
      const r = await fetch('/api/telegram/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { setMasters([]); return; }
      const j = (await r.json()) as { masters?: ApiMasterRow[] };
      const list = (j.masters ?? []).map((row) => normalize(row, userLocation));
      setMasters(list);
    } catch {
      setMasters([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation, cat]);

  // Initial + on query change
  const queryRef = useRef(query);
  queryRef.current = query;
  useEffect(() => {
    const id = setTimeout(() => fetchData(queryRef.current, center), 250);
    return () => clearTimeout(id);
  }, [query, center, fetchData]);

  // Apply filter chips on client
  const filtered = useMemo(() => {
    let out = masters.slice();
    if (fRating) out = out.filter((m) => m.rating >= 4.5);
    if (fPrice) out = out.filter((m) => m.priceFrom != null && m.priceFrom <= 500);
    if (fDistance) out = out.filter((m) => m.distanceKm != null && m.distanceKm <= 3);
    // fToday — без серверной фильтрации (нет данных о слотах per master в /api/telegram/nearby);
    // при включении показываем всех (UI-only). Реальная серверная фильтрация - отдельная задача.
    // Sort by distance if user has location
    if (userLocation) out.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    return out;
  }, [masters, fRating, fPrice, fDistance, userLocation]);

  function clearQuery() {
    setQuery('');
    haptic('light');
  }

  async function recenter() {
    setGeoBusy(true);
    try {
      const pos = await getLocation();
      if (pos) {
        setCenter([pos.lat, pos.lng]);
        setUserLocation([pos.lat, pos.lng]);
        setGeoDenied(false);
      }
    } finally {
      setGeoBusy(false);
    }
  }

  return (
    <MobilePage className="od-client-mini-app">
      {/* Top bar: title + filter icon. Если задана ?cat= — показываем категорию. */}
      <div className="mc-top">
        <div>
          <div className="mc-top-title">
            {cat && CATEGORY_LABELS[cat]?.[lang] ? CATEGORY_LABELS[cat][lang] : t.title}
          </div>
          {cat && CATEGORY_LABELS[cat]?.[lang] && (
            <div className="mc-top-sub" style={{ marginTop: 2 }}>
              {filtered.length > 0
                ? `${filtered.length} ${plural(filtered.length, lang)}`
                : (lang === 'uk' ? 'Поки нікого' : lang === 'ru' ? 'Пока никого' : 'No results')}
            </div>
          )}
        </div>
        <button
          className="mc-icbtn"
          onClick={() => {
            haptic('light');
            // Скролл к chips — пока расширенный фильтр sheet не реализован
            const chips = document.querySelector('.mc-fchips') as HTMLElement | null;
            if (chips) chips.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          aria-label="Фільтри"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Search pill (input) */}
      <div className="mc-search-wrap">
        <Search size={18} strokeWidth={2} />
        <input
          className="mc-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchHint}
          enterKeyHint="search"
        />
        {query && (
          <button
            onClick={clearQuery}
            className="mc-search-clear"
            aria-label="Очистити"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter chips — horizontal scroll. Только работающие фильтры. */}
      <div className="mc-fchips">
        <Chip active={fToday} onClick={() => { setFToday(!fToday); haptic('selection'); }} icon={<Check size={12} />}>{t.today}</Chip>
        <Chip active={fRating} onClick={() => { setFRating(!fRating); haptic('selection'); }} icon={<Star size={12} />}>{t.rating}</Chip>
        <Chip active={fPrice} onClick={() => { setFPrice(!fPrice); haptic('selection'); }} icon={<Coins size={12} />}>{t.budget}</Chip>
        <Chip active={fDistance} onClick={() => { setFDistance(!fDistance); haptic('selection'); }} icon={<MapPin size={12} />}>{t.distance}</Chip>
      </div>

      {/* Toolbar: count + list/map */}
      <div className="mc-tools">
        <div>
          <b>{filtered.length}</b> {plural(filtered.length, lang)}
        </div>
        <div className="mc-tools-r">
          <div className="mc-view">
            <button
              className={`mc-view-b ${view === 'list' ? 'active' : ''}`}
              onClick={() => { setView('list'); haptic('selection'); }}
            >
              <List size={12} /> {t.list}
            </button>
            <button
              className={`mc-view-b ${view === 'map' ? 'active' : ''}`}
              onClick={() => { setView('map'); haptic('selection'); }}
            >
              <MapIcon size={12} /> {t.map}
            </button>
          </div>
          <button
            className="mc-icbtn-mini"
            onClick={recenter}
            disabled={geoBusy}
            aria-label="Моя локація"
          >
            {geoBusy ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
          </button>
        </div>
      </div>

      {geoDenied && (
        <div className="mc-geohint">{t.geoHint}</div>
      )}

      {/* Results */}
      {loading ? (
        <div className="mc-loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mc-empty">
          <Search size={32} strokeWidth={1.5} />
          <p className="mc-empty-t">{t.empty}</p>
          <span className="mc-empty-s">{t.emptyHint}</span>
        </div>
      ) : view === 'map' ? (
        <div className="mc-mapwrap">
          <MapView
            markers={filtered
              .filter((m): m is Master & { lat: number; lng: number } => m.lat != null && m.lng != null)
              .map((m) => ({
                lat: m.lat,
                lng: m.lng,
                name: m.name,
                rating: m.rating,
                specialization: m.specialization ?? undefined,
                masterId: m.id,
              } satisfies MapMarker))}
            center={center}
            zoom={userLocation ? 13 : 11}
            userLocation={userLocation}
            onMarkerClick={(masterId) => {
              haptic('light');
              router.push(`/telegram/search/${masterId}`);
            }}
            className="mc-mapview"
          />
        </div>
      ) : (
        <div className="mc-results">
          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/telegram/search/${m.id}`}
              onClick={() => haptic('light')}
              className="mc-result"
            >
              <div className="mc-result-av">
                {m.avatar
                  ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  : initialsOf(m.name)}
              </div>
              <div className="mc-result-i">
                <div className="mc-result-n">{m.name}</div>
                {(m.specialization || m.city) && (
                  <div className="mc-result-s">
                    {m.specialization ?? '—'}{m.city ? ` · ${m.city}` : ''}
                  </div>
                )}
                <div className="mc-result-m">
                  <span><Star size={10} className="star" /> {m.rating > 0 ? m.rating.toFixed(1) : '—'}{m.reviewsCount > 0 ? ` · ${m.reviewsCount}` : ''}</span>
                  {m.distanceKm != null && (
                    <span><MapPin size={10} /> {m.distanceKm.toFixed(1)} км</span>
                  )}
                </div>
                {m.slots.length > 0 && (
                  <div className="mc-result-m">
                    <span style={{ color: 'var(--fg-2)' }}>
                      <Clock size={10} /> {t.slots}: {m.slots.slice(0, 3).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="mc-result-r">
                <div className="mc-result-p">
                  {m.priceFrom != null ? `від ₴${Math.round(m.priceFrom)}` : '—'}
                </div>
                <button
                  className="mc-result-cta"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    haptic('light');
                    router.push(`/telegram/book?master_id=${m.id}`);
                  }}
                >
                  {t.bookCta}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
    </MobilePage>
  );
}

function Chip({
  active, onClick, children, icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button className={`mc-fchip ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
