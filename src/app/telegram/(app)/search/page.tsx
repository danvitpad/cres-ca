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
} from 'lucide-react';
import { getLocation } from '@/lib/telegram/geolocation';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import type { MapMarker, SalonMarker } from '@/components/shared/map-view';
import { BottomSheet } from '@/components/shared/primitives/bottom-sheet';
import {
  resolveCardDisplay,
  type MasterRef,
  type SalonRef,
} from '@/lib/client/display-mode';

const MapView = dynamic(() => import('@/components/shared/map-view'), { ssr: false });

const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234];

const MINIAPP_CARD_LABELS = {
  masterPlaceholder: 'Мастер',
  salonPlaceholder: 'Салон',
  managerAssigned: 'Мастер будет назначен администратором',
};

const CATEGORIES = [
  { key: 'all', label: 'Все' },
  { key: 'beauty', label: 'Красота' },
  { key: 'health', label: 'Здоровье' },
  { key: 'wellness', label: 'Велнес' },
  { key: 'home', label: 'Дом' },
  { key: 'auto', label: 'Авто' },
  { key: 'fitness', label: 'Фитнес' },
  { key: 'petCare', label: 'Питомцы' },
] as const;

const RATING_OPTS = [
  { v: 0, label: 'Любой' },
  { v: 4, label: '4.0+' },
  { v: 4.5, label: '4.5+' },
] as const;

interface ApiMasterRow {
  id: string;
  specialization: string | null;
  rating: number | null;
  salon_id: string | null;
  latitude: number | null;
  longitude: number | null;
  display_name: string | null;
  avatar_url: string | null;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
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
  salonId: string | null;
  lat: number | null;
  lng: number | null;
  salon: { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null } | null;
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function normalizeMaster(row: ApiMasterRow): NormMaster {
  const p = unwrap(row.profile);
  const salon = unwrap(row.salon);
  return {
    id: row.id,
    displayName: row.display_name ?? p?.full_name ?? 'Мастер',
    fullName: p?.full_name ?? null,
    specialization: row.specialization,
    rating: Number(row.rating ?? 0),
    avatar: row.avatar_url,
    salonId: row.salon_id,
    lat: row.latitude,
    lng: row.longitude,
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

  const [view, setView] = useState<'list' | 'map'>(sp.get('view') === 'map' ? 'map' : 'list');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]['key']>('all');
  const [minRating, setMinRating] = useState<0 | 4 | 4.5>(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  const [masters, setMasters] = useState<NormMaster[]>([]);
  const [salons, setSalons] = useState<ApiSalonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NormMaster | null>(null);

  const centerRef = useRef(center);
  centerRef.current = center;

  const fetchData = useCallback(async (searchQuery?: string, lat?: number, lng?: number) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = searchQuery ? { q: searchQuery } : { lat, lng };
      const res = await fetch('/api/telegram/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setLoading(false); return; }
      const json = (await res.json()) as { masters?: ApiMasterRow[]; salons?: ApiSalonRow[] };
      setMasters((json.masters ?? []).map(normalizeMaster));
      setSalons(json.salons ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

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
            await fetchData(undefined, pos.lat, pos.lng);
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
              await fetchData(undefined, r.lat, r.lng);
              return;
            }
          } catch {
            /* next */
          }
        }

        setGeoDenied(true);
        await fetchData(undefined, DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      } finally {
        setGeoBusy(false);
      }
    },
    [fetchData, haptic],
  );

  useEffect(() => {
    locate(false);
  }, [locate]);

  // Debounced name search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      if (!loading) fetchData(undefined, centerRef.current[0], centerRef.current[1]);
      return;
    }
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => fetchData(trimmed), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Client-side filter by category/rating (keeps API simple)
  const filteredMasters = useMemo(() => {
    return masters.filter((m) => {
      if (minRating > 0 && m.rating < minRating) return false;
      if (category !== 'all') {
        const target = CATEGORIES.find((c) => c.key === category)?.label ?? '';
        if (!(m.specialization ?? '').toLowerCase().includes(target.toLowerCase())) return false;
      }
      return true;
    });
  }, [masters, minRating, category]);

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

  const activeFilters = (category !== 'all' ? 1 : 0) + (minRating > 0 ? 1 : 0);
  const total = filteredMasters.length + filteredSalons.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top controls */}
      <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5">
            <Search className="size-4 shrink-0 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Мастер, услуга, салон…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-white/50">
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => { haptic('light'); setFiltersOpen(true); }}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
          >
            <SlidersHorizontal className="size-4" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold">
                {activeFilters}
              </span>
            )}
          </button>
          <button
            onClick={() => locate(true)}
            disabled={geoBusy}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors disabled:opacity-60"
          >
            {geoBusy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          </button>
        </div>

        <div className="inline-flex self-start rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {(['list', 'map'] as const).map((mode) => {
            const Icon = mode === 'list' ? List : MapIcon;
            return (
              <button
                key={mode}
                onClick={() => { haptic('selection'); setView(mode); }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  view === mode ? 'bg-white text-[#0b0d17]' : 'text-white/60'
                }`}
              >
                <Icon className="size-3" />
                {mode === 'list' ? 'Список' : 'Карта'}
              </button>
            );
          })}
          {!loading && (
            <span className="ml-2 flex items-center pr-3 text-[10px] text-white/40 tabular-nums">
              {total}
            </span>
          )}
        </div>

        {geoDenied && !geoBusy && (
          <p className="flex items-center gap-1 text-[10px] text-white/50">
            <Navigation className="size-3" /> Включите геолокацию, чтобы видеть мастеров рядом
          </p>
        )}
      </div>

      {/* Results body */}
      {view === 'list' ? (
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-white/50" />
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-white/50">
              <Search className="size-9 mb-2 opacity-40" />
              <p className="text-sm font-medium text-white/70">Ничего не найдено</p>
              <p className="mt-1 text-[11px]">Попробуйте изменить запрос или фильтры</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
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
                      onClick={() => { haptic('selection'); router.push(`/telegram/search/${m.id}`); }}
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
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <Loader2 className="size-7 animate-spin text-white/80" />
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

          {!loading && (
            <div className="absolute left-3 top-3 z-[500] rounded-full border border-white/10 bg-[#0b0d17]/90 px-3 py-1.5 text-[11px] font-semibold tabular-nums">
              {markers.length} · {salonMarkers.length}
            </div>
          )}

          <AnimatePresence>
            {selected && (
              <motion.button
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={() => router.push(`/telegram/search/${selected.id}`)}
                className="absolute bottom-3 left-3 right-3 z-[600] flex items-center gap-3 rounded-2xl border border-white/10 bg-[#26272b]/95 backdrop-blur-xl p-3 text-left active:bg-white/[0.06] transition-colors"
              >
                {(() => {
                  const d = resolveCardDisplay(toMasterRef(selected), toSalonRef(selected.salon), MINIAPP_CARD_LABELS);
                  const Icon = d.mode === 'solo' ? UserIcon : Building2;
                  return (
                    <>
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-base font-bold text-white/90">
                        {d.avatarSrc ? (
                          <Image src={d.avatarSrc} alt="" width={48} height={48} className="size-full object-cover" />
                        ) : (
                          d.avatarName[0]?.toUpperCase() ?? 'M'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="size-3 shrink-0 text-white/50" />
                          <p className="truncate text-sm font-semibold">{d.primary}</p>
                        </div>
                        {d.secondary && (
                          <p className="truncate text-[11px] text-white/60">{d.secondary}</p>
                        )}
                        {d.rating != null && (
                          <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-amber-300">
                            <Star className="size-2.5 fill-amber-400" />
                            {d.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-5 text-white/50" />
                    </>
                  );
                })()}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        className="!bg-[#26272b] text-white"
      >
        <div className="space-y-5 pb-6 pt-1 text-white">
          <h3 className="text-base font-semibold">Фильтры</h3>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Категория</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    category === c.key
                      ? 'border-white bg-white text-[#0b0d17]'
                      : 'border-white/15 text-white/70 active:bg-white/[0.06]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Рейтинг</p>
            <div className="flex gap-2">
              {RATING_OPTS.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setMinRating(opt.v)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                    minRating === opt.v
                      ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                      : 'border-white/15 text-white/70 active:bg-white/[0.06]'
                  }`}
                >
                  {opt.v > 0 && <Star className="size-3 fill-amber-400 text-amber-400" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setCategory('all'); setMinRating(0); }}
              className="flex-1 rounded-xl border border-white/15 bg-transparent py-3 text-sm font-medium text-white/70 active:bg-white/[0.06]"
            >
              Сбросить
            </button>
            <button
              onClick={() => { haptic('light'); setFiltersOpen(false); }}
              className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-[#0b0d17] active:opacity-90"
            >
              Показать ({total})
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

interface MiniResultCardProps {
  master: MasterRef | null;
  salon: SalonRef | null;
  onClick: () => void;
}

function MiniResultCard({ master, salon, onClick }: MiniResultCardProps) {
  const d = resolveCardDisplay(master, salon, MINIAPP_CARD_LABELS);
  const Icon = d.mode === 'solo' ? UserIcon : Building2;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left active:bg-white/[0.06] transition-colors"
    >
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-base font-bold text-white/90">
        {d.avatarSrc ? (
          <Image src={d.avatarSrc} alt="" width={48} height={48} className="size-full object-cover" />
        ) : (
          d.avatarName[0]?.toUpperCase() ?? '?'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3 shrink-0 text-white/50" />
          <p className="truncate text-sm font-semibold">{d.primary}</p>
        </div>
        {d.secondary && <p className="truncate text-[11px] text-white/60">{d.secondary}</p>}
        {d.rating != null && (
          <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-amber-300">
            <Star className="size-2.5 fill-amber-400" />
            {d.rating.toFixed(1)}
          </div>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-white/40" />
    </button>
  );
}
