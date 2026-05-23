/** --- YAML
 * name: ClientSearchPage
 * description: Пошук майстрів — фільтри (чипи + popovers), сортування, list/map toggle.
 *              Візуал — web-client/search мокап. Карта — placeholder з пинами цін на сітці.
 * created: 2026-04-19
 * updated: 2026-05-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  Star, MapPin, Clock, Coins, Check, ChevronDown, List, Map as MapIcon, Locate, Search as SearchIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type SearchLang = 'uk' | 'ru' | 'en';
const SEARCH_LABELS: Record<SearchLang, {
  master: string;
  inCity: (city: string) => string;
  masters: string;
  searching: string;
  foundResult: (n: number) => string;
  today: string;
  rating: string;
  minRating: string;
  anyRating: string;
  rating47: string;
  rating48: string;
  price: string;
  yourBudget: string;
  upTo: (p: number) => string;
  cheap: string;
  premium: string;
  proximity: string;
  findByGeo: string;
  orAddress: string;
  addressPlaceholder: string;
  radius: string;
  radiusAny: string;
  radius1km: string;
  radius3km: string;
  radius10km: string;
  female: string;
  mobile: string;
  sortBy: string;
  list: string;
  map: string;
  fromPrice: string;
  noResultsTitle: string;
  noResultsDesc: string;
  resetFilters: string;
  reviewsAbbr: string;
  scheduleOnPage: string;
  mapSoon: string;
  bookCta: string;
  sort: Record<SortMode, string>;
  cat: Record<'hair' | 'nails' | 'face' | 'massage' | 'brows' | 'laser' | 'skin' | 'all', string>;
}> = {
  uk: {
    master: 'Майстер',
    inCity: (c) => ` у ${c}`,
    masters: 'Майстри',
    searching: 'Шукаємо…',
    foundResult: (n) => `Знайшли ${n} ${n === 1 ? 'майстра' : n < 5 ? 'майстрів' : 'майстрів'}`,
    today: 'Сьогодні',
    rating: 'Рейтинг', minRating: 'Мінімальний рейтинг',
    anyRating: 'Будь-який', rating47: '⭐ 4.7+', rating48: '⭐ 4.8+ (топ)',
    price: 'Ціна', yourBudget: 'Ваш бюджет', upTo: (p) => `до ₴${p}`,
    cheap: 'дешево', premium: 'преміум',
    proximity: 'Близькість', findByGeo: 'Знайти за геопозицією',
    orAddress: 'Або вкажіть адресу', addressPlaceholder: 'вул. Хрещатик 12, Київ',
    radius: 'Радіус', radiusAny: 'Будь-який', radius1km: '1 км', radius3km: '3 км', radius10km: '10 км',
    female: 'Тільки жінки', mobile: 'Виїзд', sortBy: 'Сортувати',
    list: 'Список', map: 'Карта', fromPrice: 'від',
    noResultsTitle: 'Нічого не знайшли', noResultsDesc: 'Спробуй прибрати фільтри або змінити місто.',
    resetFilters: 'Скинути фільтри',
    reviewsAbbr: 'відг.', scheduleOnPage: 'графік на сторінці',
    mapSoon: 'Карта · скоро', bookCta: 'Записатись',
    sort: { rating: 'Рейтингом', distance: 'Відстанню', price_asc: 'Ціною ↑', price_desc: 'Ціною ↓', next_slot: 'Найближчий слот' },
    cat: { hair: 'Волосся', nails: 'Манікюр', face: 'Обличчя', massage: 'Масаж', brows: 'Брови', laser: 'Лазер', skin: 'Шкіра', all: 'Усі категорії' },
  },
  ru: {
    master: 'Мастер',
    inCity: (c) => ` в ${c}`,
    masters: 'Мастера',
    searching: 'Ищем…',
    foundResult: (n) => `Нашли ${n} ${n === 1 ? 'мастера' : n < 5 ? 'мастера' : 'мастеров'}`,
    today: 'Сегодня',
    rating: 'Рейтинг', minRating: 'Минимальный рейтинг',
    anyRating: 'Любой', rating47: '⭐ 4.7+', rating48: '⭐ 4.8+ (топ)',
    price: 'Цена', yourBudget: 'Ваш бюджет', upTo: (p) => `до ₴${p}`,
    cheap: 'дёшево', premium: 'премиум',
    proximity: 'Близость', findByGeo: 'Найти по геолокации',
    orAddress: 'Или укажите адрес', addressPlaceholder: 'ул. Сумская 12, Харьков',
    radius: 'Радиус', radiusAny: 'Любой', radius1km: '1 км', radius3km: '3 км', radius10km: '10 км',
    female: 'Только женщины', mobile: 'Выезд', sortBy: 'Сортировать',
    list: 'Список', map: 'Карта', fromPrice: 'от',
    noResultsTitle: 'Ничего не нашли', noResultsDesc: 'Попробуй убрать фильтры или изменить город.',
    resetFilters: 'Сбросить фильтры',
    reviewsAbbr: 'отз.', scheduleOnPage: 'график на странице',
    mapSoon: 'Карта · скоро', bookCta: 'Записаться',
    sort: { rating: 'Рейтингу', distance: 'Расстоянию', price_asc: 'Цене ↑', price_desc: 'Цене ↓', next_slot: 'Ближайший слот' },
    cat: { hair: 'Волосы', nails: 'Маникюр', face: 'Лицо', massage: 'Массаж', brows: 'Брови', laser: 'Лазер', skin: 'Кожа', all: 'Все категории' },
  },
  en: {
    master: 'Master',
    inCity: (c) => ` in ${c}`,
    masters: 'Masters',
    searching: 'Searching…',
    foundResult: (n) => `Found ${n} master${n === 1 ? '' : 's'}`,
    today: 'Today',
    rating: 'Rating', minRating: 'Minimum rating',
    anyRating: 'Any', rating47: '⭐ 4.7+', rating48: '⭐ 4.8+ (top)',
    price: 'Price', yourBudget: 'Your budget', upTo: (p) => `up to ₴${p}`,
    cheap: 'cheap', premium: 'premium',
    proximity: 'Proximity', findByGeo: 'Find by geolocation',
    orAddress: 'Or enter address', addressPlaceholder: '12 Main St, Kyiv',
    radius: 'Radius', radiusAny: 'Any', radius1km: '1 km', radius3km: '3 km', radius10km: '10 km',
    female: 'Female only', mobile: 'Mobile', sortBy: 'Sort',
    list: 'List', map: 'Map', fromPrice: 'from',
    noResultsTitle: 'Nothing found', noResultsDesc: 'Try removing filters or changing city.',
    resetFilters: 'Reset filters',
    reviewsAbbr: 'rev.', scheduleOnPage: 'schedule on page',
    mapSoon: 'Map · coming soon', bookCta: 'Book',
    sort: { rating: 'Rating', distance: 'Distance', price_asc: 'Price ↑', price_desc: 'Price ↓', next_slot: 'Next slot' },
    cat: { hair: 'Hair', nails: 'Nails', face: 'Face', massage: 'Massage', brows: 'Brows', laser: 'Laser', skin: 'Skin', all: 'All categories' },
  },
};

interface MasterRow {
  id: string;
  slug: string | null;
  invite_code: string | null;
  display_name: string | null;
  specialization: string | null;
  rating: number | null;
  city: string | null;
  avatar_url: string | null;
  reviewsCount: number;
  minPrice: number | null;
  fullName: string;
}

type SortMode = 'rating' | 'distance' | 'price_asc' | 'price_desc' | 'next_slot';
type ViewMode = 'list' | 'map';

export default function SearchPage() {
  const sp = useSearchParams();
  const localeRaw = useLocale();
  const lang: SearchLang = (['uk', 'ru', 'en'].includes(localeRaw) ? localeRaw : 'uk') as SearchLang;
  const L = SEARCH_LABELS[lang];
  const SORT_LABELS = L.sort;
  const initialQ = sp?.get('q') ?? '';
  const initialCity = sp?.get('city') ?? '';
  const initialCat = sp?.get('cat') ?? '';

  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [todayOnly, setTodayOnly] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(2000);
  const [radius, setRadius] = useState<'any' | '1km' | '3km' | '10km'>('any');
  const [addressInput, setAddressInput] = useState('');
  const [femaleOnly, setFemaleOnly] = useState(false);
  const [mobileOnly, setMobileOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>('rating');
  const [view, setView] = useState<ViewMode>('list');

  const fetchMasters = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
    let q = supabase
      .from('masters')
      .select('id, slug, invite_code, display_name, specialization, rating, city, avatar_url, profiles:profiles!masters_profile_id_fkey(full_name)')
      .eq('is_active', true)
      .limit(50);
    if (city.trim()) q = q.ilike('city', `%${city.trim()}%`);
    if (initialCat && categoryToTerm(initialCat)) q = q.ilike('specialization', `%${categoryToTerm(initialCat)}%`);
    if (query.trim()) q = q.or(`display_name.ilike.%${query.trim()}%,specialization.ilike.%${query.trim()}%`);

    const { data } = await q;
    const list = (data ?? []) as Array<{
      id: string; slug: string | null; invite_code: string | null;
      display_name: string | null; specialization: string | null;
      rating: number | null; city: string | null; avatar_url: string | null;
      profiles: { full_name: string | null } | { full_name: string | null }[] | null;
    }>;

    const masterIds = list.map((m) => m.id);

    // reviews count
    const reviewsByMaster = new Map<string, number>();
    if (masterIds.length > 0) {
      const { data: revs } = await supabase
        .from('reviews').select('target_id')
        .eq('target_type', 'master').in('target_id', masterIds);
      (revs ?? []).forEach((r) => {
        const id = (r as { target_id: string }).target_id;
        reviewsByMaster.set(id, (reviewsByMaster.get(id) ?? 0) + 1);
      });
    }

    // min price from services
    const minPriceByMaster = new Map<string, number>();
    if (masterIds.length > 0) {
      const { data: svcs } = await supabase
        .from('services').select('master_id, price')
        .in('master_id', masterIds).eq('is_active', true);
      (svcs ?? []).forEach((s) => {
        const r = s as { master_id: string; price: number | string | null };
        if (r.price == null) return;
        const p = Number(r.price);
        if (!p) return;
        const cur = minPriceByMaster.get(r.master_id);
        if (cur == null || p < cur) minPriceByMaster.set(r.master_id, p);
      });
    }

    const result: MasterRow[] = list.map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        id: m.id,
        slug: m.slug,
        invite_code: m.invite_code,
        display_name: m.display_name,
        specialization: m.specialization,
        rating: m.rating,
        city: m.city,
        avatar_url: m.avatar_url,
        fullName: (m.display_name ?? profile?.full_name ?? L.master).toString(),
        reviewsCount: reviewsByMaster.get(m.id) ?? 0,
        minPrice: minPriceByMaster.get(m.id) ?? null,
      };
    });
      setMasters(result);
    } catch (e) {
      console.warn('[search] fetchMasters err', e);
    } finally {
      setLoading(false);
    }
  }, [city, initialCat, query]);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  // Apply client-side filters + sort
  const filtered = useMemo(() => {
    let out = masters.slice();
    if (minRating > 0) out = out.filter((m) => (m.rating ?? 0) >= minRating);
    if (maxPrice < 2000) out = out.filter((m) => m.minPrice != null && m.minPrice <= maxPrice);
    switch (sort) {
      case 'rating': out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      case 'price_asc': out.sort((a, b) => (a.minPrice ?? 1e9) - (b.minPrice ?? 1e9)); break;
      case 'price_desc': out.sort((a, b) => (b.minPrice ?? 0) - (a.minPrice ?? 0)); break;
      default: out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return out;
  }, [masters, minRating, maxPrice, sort]);

  function detectLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=uk`);
        const j = await r.json();
        const c = j.address?.city || j.address?.town || j.address?.village;
        if (c) setCity(c);
      } catch {}
    });
  }

  const catLabel = initialCat && (initialCat in L.cat)
    ? L.cat[initialCat as keyof typeof L.cat]
    : '';
  const headerTitle = `${catLabel || (query.trim() || L.masters)}${city ? L.inCity(city) : ''}`;

  return (
    <div className="space-y-5 pb-12">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight">{headerTitle}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {loading ? L.searching : L.foundResult(filtered.length)}
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={todayOnly} onClick={() => setTodayOnly((v) => !v)} icon={<Check className="size-3.5" />}>
          {L.today}
        </FilterChip>

        <Popover>
          <PopoverTrigger className={chipClass(minRating > 0)}>
            <Star className="size-3.5" /> {L.rating} {minRating > 0 ? `${minRating}+` : ''}
            <ChevronDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[220px] p-2">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L.minRating}</div>
            {[
              [0, L.anyRating],
              [4.0, '⭐ 4.0+'],
              [4.5, '⭐ 4.5+'],
              [4.8, L.rating48],
            ].map(([v, l]) => (
              <button
                key={v as number}
                onClick={() => setMinRating(v as number)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] transition-colors',
                  minRating === v ? 'bg-[#2563eb]/10 text-[#2563eb] font-semibold' : 'hover:bg-muted',
                )}
              >
                <span className={cn(
                  'size-3.5 shrink-0 rounded-full border-2',
                  minRating === v ? 'border-[#2563eb] bg-[#2563eb]' : 'border-border',
                )} />
                {l}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className={chipClass(maxPrice < 2000)}>
            <Coins className="size-3.5" /> {L.price} {maxPrice < 2000 ? L.upTo(maxPrice) : ''}
            <ChevronDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L.yourBudget}</div>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">₴100</span>
              <span className="font-semibold text-[#2563eb]">{L.upTo(maxPrice)}</span>
              <span className="text-muted-foreground">₴2000+</span>
            </div>
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="mt-2 w-full accent-[#2563eb]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
              <span>{L.cheap}</span>
              <span>{L.premium}</span>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className={chipClass(radius !== 'any' || !!city)}>
            <MapPin className="size-3.5" /> {L.proximity}
            <ChevronDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-3 space-y-2.5">
            <button
              onClick={detectLocation}
              className="flex w-full items-center gap-2 rounded-xl bg-[#2563eb]/10 px-3 py-2.5 text-[13px] font-semibold text-[#2563eb] hover:bg-[#2563eb]/15"
            >
              <Locate className="size-3.5" /> {L.findByGeo}
            </button>
            <div className="border-t border-border" />
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L.orAddress}</div>
            <input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setCity(addressInput); }}
              placeholder={L.addressPlaceholder}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]"
            />
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{L.radius}</div>
            {([
              ['any', L.radiusAny],
              ['1km', L.radius1km],
              ['3km', L.radius3km],
              ['10km', L.radius10km],
            ] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setRadius(v)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] transition-colors',
                  radius === v ? 'bg-[#2563eb]/10 text-[#2563eb] font-semibold' : 'hover:bg-muted',
                )}
              >
                <span className={cn(
                  'size-3.5 shrink-0 rounded-full border-2',
                  radius === v ? 'border-[#2563eb] bg-[#2563eb]' : 'border-border',
                )} />
                {l}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <FilterChip active={femaleOnly} onClick={() => setFemaleOnly((v) => !v)}>{L.female}</FilterChip>
        <FilterChip active={mobileOnly} onClick={() => setMobileOnly((v) => !v)}>{L.mobile}</FilterChip>
      </div>

      {/* Toolbar: count + sort + view */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          {L.foundResult(filtered.length)}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-muted">
              <span>{SORT_LABELS[sort]}</span>
              <ChevronDown className="size-3" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[200px] p-1.5">
              {(Object.entries(SORT_LABELS) as Array<[SortMode, string]>).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] transition-colors',
                    sort === k ? 'bg-[#2563eb]/10 text-[#2563eb] font-semibold' : 'hover:bg-muted',
                  )}
                >
                  <span className={cn(
                    'size-3.5 shrink-0 rounded-full border-2',
                    sort === k ? 'border-[#2563eb] bg-[#2563eb]' : 'border-border',
                  )} />
                  {l}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="inline-flex rounded-full border border-border bg-card p-0.5">
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-colors',
                view === 'list' ? 'bg-[#2563eb] text-white' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={L.list}
            >
              <List className="size-3.5" />
            </button>
            <button
              onClick={() => setView('map')}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-colors',
                view === 'map' ? 'bg-[#2563eb] text-white' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={L.map}
            >
              <MapIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#2563eb]/12 text-[#2563eb]">
            <SearchIcon className="size-6" />
          </div>
          <p className="mt-4 text-[15px] font-semibold">{L.noResultsTitle}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {L.noResultsDesc}
          </p>
        </div>
      ) : (
        <div className={cn('grid gap-4', view === 'list' ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1')}>
          {/* Results list */}
          <div className="flex flex-col gap-2.5">
            {filtered.map((m) => <ResultRow key={m.id} m={m} L={L} />)}
          </div>

          {/* Map column (sticky on desktop) — light grid placeholder, не агрессивный */}
          {view === 'list' && (
            <div className="hidden lg:block">
              <div
                className="sticky top-6 h-[480px] overflow-hidden rounded-2xl border border-border bg-muted/30"
                style={{
                  backgroundImage:
                    'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              >
                <div className="relative size-full">
                  {filtered.slice(0, 6).map((m, i) => {
                    const left = 20 + (i % 3) * 30;
                    const top = 20 + Math.floor(i / 3) * 30;
                    return (
                      <Link
                        key={m.id}
                        href={`/m/${m.slug ?? m.invite_code ?? m.id}`}
                        className="absolute flex items-center gap-1 rounded-full bg-[#2563eb] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-lg ring-2 ring-[#2563eb]/20 hover:bg-[#1d4ed8]"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      >
                        {m.minPrice ? `₴${Math.round(m.minPrice)}` : '—'}
                      </Link>
                    );
                  })}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
                    {L.mapSoon}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ m, L }: { m: MasterRow; L: typeof SEARCH_LABELS[SearchLang] }) {
  const initials = m.fullName.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
  return (
    <Link
      href={`/m/${m.slug ?? m.invite_code ?? m.id}`}
      className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/40 hover:shadow-md"
    >
      {m.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.avatar_url} alt={m.fullName} className="size-14 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/12 text-[16px] font-extrabold text-[#2563eb]">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{m.fullName}</div>
        {m.specialization && (
          <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{m.specialization}{m.city ? ` · ${m.city}` : ''}</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <strong className="text-foreground">{m.rating ? m.rating.toFixed(1) : '—'}</strong>
            {m.reviewsCount > 0 ? ` · ${m.reviewsCount} ${L.reviewsAbbr}` : ''}
          </span>
          {m.city && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {m.city}
              </span>
            </>
          )}
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {L.scheduleOnPage}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-bold text-foreground">
          {m.minPrice ? `${L.fromPrice} ₴${Math.round(m.minPrice)}` : '—'}
        </div>
        <span className="mt-1.5 inline-flex items-center justify-center rounded-full bg-[#2563eb] px-4 py-1.5 text-[12px] font-semibold text-white">
          {L.bookCta}
        </span>
      </div>
    </Link>
  );
}

function FilterChip({
  active, onClick, children, icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={chipClass(active)}>
      {icon}
      {children}
    </button>
  );
}

function chipClass(active: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
    active
      ? 'border-[#2563eb] bg-[#2563eb] text-white'
      : 'border-border bg-card text-muted-foreground hover:bg-muted',
  );
}

function categoryToTerm(cat: string): string {
  const map: Record<string, string> = {
    hair: 'волосс', nails: 'манік', face: 'облич', massage: 'масаж',
    brows: 'бров', laser: 'лазер', skin: 'шкір',
  };
  return map[cat] ?? '';
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    hair: 'Волосся', nails: 'Манікюр', face: 'Обличчя', massage: 'Масаж',
    brows: 'Брови', laser: 'Лазер', skin: 'Шкіра', all: 'Усі категорії',
  };
  return map[cat] ?? '';
}

function pluralMaster(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'майстра';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'майстри';
  return 'майстрів';
}
