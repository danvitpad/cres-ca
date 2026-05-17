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
import {
  Star, MapPin, Clock, Coins, Check, ChevronDown, List, Map as MapIcon, Locate, Search as SearchIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

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

const SORT_LABELS: Record<SortMode, string> = {
  rating: 'Рейтингом',
  distance: 'Відстанню',
  price_asc: 'Ціною ↑',
  price_desc: 'Ціною ↓',
  next_slot: 'Найближчий слот',
};

export default function SearchPage() {
  const sp = useSearchParams();
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
        fullName: (m.display_name ?? profile?.full_name ?? 'Майстер').toString(),
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

  const headerTitle = `${categoryLabel(initialCat) || (query.trim() || 'Майстри')}${city ? ` у ${city}` : ''}`;

  return (
    <div className="space-y-5 pb-12">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight">{headerTitle}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {loading ? 'Шукаємо…' : `Знайшли ${filtered.length} ${pluralMaster(filtered.length)}, готов${filtered.length === 1 ? 'ий' : 'і'} прийняти`}
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={todayOnly} onClick={() => setTodayOnly((v) => !v)} icon={<Check className="size-3.5" />}>
          Сьогодні
        </FilterChip>

        <Popover>
          <PopoverTrigger className={chipClass(minRating > 0)}>
            <Star className="size-3.5" /> Рейтинг {minRating > 0 ? `${minRating}+` : ''}
            <ChevronDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[220px] p-2">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Мінімальний рейтинг</div>
            {[
              [0, 'Будь-який'],
              [4.0, '⭐ 4.0+'],
              [4.5, '⭐ 4.5+'],
              [4.8, '⭐ 4.8+ (топ)'],
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
            <Coins className="size-3.5" /> Ціна {maxPrice < 2000 ? `до ₴${maxPrice}` : ''}
            <ChevronDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ваш бюджет</div>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">₴100</span>
              <span className="font-semibold text-[#2563eb]">до ₴{maxPrice}</span>
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
              <span>дешево</span>
              <span>преміум</span>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className={chipClass(radius !== 'any' || !!city)}>
            <MapPin className="size-3.5" /> Близькість
            <ChevronDown className="size-3 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-3 space-y-2.5">
            <button
              onClick={detectLocation}
              className="flex w-full items-center gap-2 rounded-xl bg-[#2563eb]/10 px-3 py-2.5 text-[13px] font-semibold text-[#2563eb] hover:bg-[#2563eb]/15"
            >
              <Locate className="size-3.5" /> Знайти за геопозицією
            </button>
            <div className="border-t border-border" />
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Або вкажіть адресу</div>
            <input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setCity(addressInput); }}
              placeholder="вул. Хрещатик 12, Київ"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]"
            />
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Радіус</div>
            {([
              ['any', 'Будь-яка відстань'],
              ['1km', 'До 1 км пішки'],
              ['3km', 'До 3 км'],
              ['10km', 'До 10 км'],
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

        <FilterChip active={femaleOnly} onClick={() => setFemaleOnly((v) => !v)}>Жінка-майстер</FilterChip>
        <FilterChip active={mobileOnly} onClick={() => setMobileOnly((v) => !v)}>Виїзд додому</FilterChip>
      </div>

      {/* Toolbar: count + sort + view */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          <strong className="text-foreground">{filtered.length}</strong> {pluralMaster(filtered.length)} знайдено
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
              aria-label="Список"
            >
              <List className="size-3.5" />
            </button>
            <button
              onClick={() => setView('map')}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-colors',
                view === 'map' ? 'bg-[#2563eb] text-white' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label="Карта"
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
          <p className="mt-4 text-[15px] font-semibold">Нічого не знайшли</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Спробуй прибрати фільтри або змінити місто.
          </p>
        </div>
      ) : (
        <div className={cn('grid gap-4', view === 'list' ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1')}>
          {/* Results list */}
          <div className="flex flex-col gap-2.5">
            {filtered.map((m) => <ResultRow key={m.id} m={m} />)}
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
                    Карта · скоро
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

function ResultRow({ m }: { m: MasterRow }) {
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
            {m.reviewsCount > 0 ? ` · ${m.reviewsCount} відг.` : ''}
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
            <Clock className="size-3" /> графік на сторінці
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-bold text-foreground">
          {m.minPrice ? `від ₴${Math.round(m.minPrice)}` : '—'}
        </div>
        <span className="mt-1.5 inline-flex items-center justify-center rounded-full bg-[#2563eb] px-4 py-1.5 text-[12px] font-semibold text-white">
          Записатись
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
