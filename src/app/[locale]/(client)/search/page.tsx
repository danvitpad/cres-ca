/** --- YAML
 * name: ClientSearchPage
 * description: Unified поиск — list/map toggle, фильтры (категория, рейтинг, радиус),
 *              soft geolocation fallback, salon-aware карточки (CRES-CA-CLIENT-PATCH).
 * created: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon,
  Navigation,
  Loader2,
  Star,
  ChevronRight,
  X as XIcon,
  List,
  Map as MapIcon,
  SlidersHorizontal,
  Building2,
  MapPin,
  UserPlus,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { MapMarker, SalonMarker } from '@/components/shared/map-view';
import {
  resolveCardDisplay,
  type MasterRef,
  type SalonRef,
} from '@/lib/client/display-mode';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { cn } from '@/lib/utils';

const MapView = dynamic(() => import('@/components/shared/map-view'), { ssr: false });

const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234]; // Kyiv
const RADIUS_PRESETS = [
  { key: 'any', deg: null as number | null },
  { key: '3km', deg: 0.03 },
  { key: '10km', deg: 0.1 },
  { key: '30km', deg: 0.3 },
] as const;

const CATEGORY_KEYS = ['all', 'beauty', 'health', 'wellness', 'home', 'auto', 'education', 'petCare', 'fitness'] as const;

interface MasterRow {
  id: string;
  specialization: string | null;
  rating: number | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  display_name: string | null;
  avatar_url: string | null;
  salon_id: string | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  salon: { id: string; name: string | null; logo_url: string | null; city: string | null; rating: number | null; slug?: string | null } | null;
}

interface SalonRow {
  id: string;
  name: string | null;
  logo_url: string | null;
  city: string | null;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  slug?: string | null;
}

function unwrap<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toMasterRef(row: MasterRow): MasterRef {
  return {
    id: row.id,
    display_name: row.display_name,
    full_name: row.profiles?.full_name ?? null,
    specialization: row.specialization,
    avatar_url: row.avatar_url ?? row.profiles?.avatar_url ?? null,
    rating: row.rating,
    salon_id: row.salon_id,
  };
}

function toSalonRef(salon: MasterRow['salon'] | SalonRow | null): SalonRef | null {
  if (!salon) return null;
  return {
    id: salon.id,
    name: salon.name ?? '',
    logo_url: salon.logo_url ?? null,
    city: salon.city ?? null,
    rating: salon.rating ?? null,
  };
}

export default function SearchPage() {
  const t = useTranslations('search');
  const tInd = useTranslations('industries');
  const tCard = useTranslations('cardLabels');
  const router = useRouter();
  const sp = useSearchParams();

  const initialView = sp.get('view') === 'map' ? 'map' : 'list';
  const [view, setView] = useState<'list' | 'map'>(initialView);
  const [query, setQuery] = useState(sp.get('q') ?? '');
  const [category, setCategory] = useState<typeof CATEGORY_KEYS[number]>('all');
  const [minRating, setMinRating] = useState<0 | 4 | 4.5>(0);
  const [radius, setRadius] = useState<typeof RADIUS_PRESETS[number]['key']>('any');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [salons, setSalons] = useState<SalonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);

  const centerRef = useRef(center);
  centerRef.current = center;

  // Sync query from URL (header search pushes /search?q=...)
  useEffect(() => {
    const q = sp.get('q');
    if (q !== null && q !== query) setQuery(q);
    const v = sp.get('view');
    if (v === 'map' && view !== 'map') setView('map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const fetchData = useCallback(
    async (opts: { lat: number; lng: number; q: string; cat: typeof category; rating: typeof minRating; rad: typeof radius }) => {
      setLoading(true);
      setHasSearched(true);
      const supabase = createClient();
      const raw = opts.q.trim();
      const qText = raw.replace(/^[@#]/, '').replace(/([%,()])/g, '\\$1');
      const hasQuery = qText.length >= 1;
      const radiusDeg = RADIUS_PRESETS.find((r) => r.key === opts.rad)?.deg ?? null;

      // Masters
      let mQ = supabase
        .from('masters')
        .select(
          'id, specialization, rating, city, latitude, longitude, display_name, avatar_url, salon_id, is_active, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(id, name, logo_url, city)',
        )
        .eq('is_active', true)
        .limit(60);

      if (radiusDeg != null) {
        mQ = mQ
          .gte('latitude', opts.lat - radiusDeg)
          .lte('latitude', opts.lat + radiusDeg)
          .gte('longitude', opts.lng - radiusDeg)
          .lte('longitude', opts.lng + radiusDeg);
      }
      if (opts.rating > 0) mQ = mQ.gte('rating', opts.rating);
      if (opts.cat !== 'all') mQ = mQ.ilike('specialization', `%${tInd(opts.cat)}%`);
      // Text search is done client-side after fetch so profiles.full_name is included.

      // Salons
      let sQ = supabase
        .from('salons')
        .select('id, name, logo_url, city, rating, latitude, longitude, slug')
        .limit(40);

      if (radiusDeg != null) {
        sQ = sQ
          .gte('latitude', opts.lat - radiusDeg)
          .lte('latitude', opts.lat + radiusDeg)
          .gte('longitude', opts.lng - radiusDeg)
          .lte('longitude', opts.lng + radiusDeg);
      }
      if (opts.rating > 0) sQ = sQ.gte('rating', opts.rating);

      const [mRes, sRes] = await Promise.all([mQ, sQ]);

      const words = hasQuery ? qText.toLowerCase().split(/\s+/).filter((w) => w.length > 0) : [];

      function masterMatchesQuery(r: MasterRow) {
        if (words.length === 0) return true;
        const haystack = [
          r.display_name,
          (unwrap(r.profiles) as { full_name: string | null } | null)?.full_name,
          r.specialization,
          r.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => haystack.includes(w));
      }

      function salonMatchesQuery(r: SalonRow) {
        if (words.length === 0) return true;
        const haystack = [r.name, r.city].filter(Boolean).join(' ').toLowerCase();
        return words.every((w) => haystack.includes(w));
      }

      setMasters(
        ((mRes.data ?? []) as unknown as MasterRow[])
          .map((r) => ({ ...r, profiles: unwrap(r.profiles), salon: unwrap(r.salon) }))
          .filter(masterMatchesQuery),
      );
      setSalons(((sRes.data ?? []) as unknown as SalonRow[]).filter(salonMatchesQuery));
      setLoading(false);
    },
    [tInd],
  );

  // Geolocation chain (same as old /map but no red banner)
  useEffect(() => {
    let cancelled = false;

    function browserGeo(highAccuracy: boolean, timeoutMs: number): Promise<[number, number] | null> {
      return new Promise((resolve) => {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => resolve(null),
          { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60000 },
        );
      });
    }

    async function ipGeo(): Promise<[number, number] | null> {
      const providers = [
        'https://ipwho.is/',
        'https://ipapi.co/json/',
        'https://get.geojs.io/v1/ip/geo.json',
      ];
      for (const url of providers) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) continue;
          const j = (await r.json()) as Record<string, unknown>;
          const lat = typeof j.latitude === 'number' ? j.latitude : parseFloat(j.latitude as string);
          const lng = typeof j.longitude === 'number' ? j.longitude : parseFloat(j.longitude as string);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
        } catch {
          /* try next */
        }
      }
      return null;
    }

    (async () => {
      setGeoBusy(true);
      let coords = await browserGeo(true, 8000);
      if (cancelled) return;
      if (!coords) coords = await browserGeo(false, 5000);
      if (cancelled) return;
      if (coords) {
        setCenter(coords);
        setUserLocation(coords);
        setGeoDenied(false);
        setGeoBusy(false);
        fetchData({ lat: coords[0], lng: coords[1], q: query, cat: category, rating: minRating, rad: radius });
        return;
      }
      coords = await ipGeo();
      if (cancelled) return;
      if (coords) {
        setCenter(coords);
        setUserLocation(coords);
        setGeoDenied(true);
      } else {
        setGeoDenied(true);
      }
      setGeoBusy(false);
      fetchData({
        lat: coords?.[0] ?? DEFAULT_CENTER[0],
        lng: coords?.[1] ?? DEFAULT_CENTER[1],
        q: query,
        cat: category,
        rating: minRating,
        rad: radius,
      });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced refetch when filters / query change
  useEffect(() => {
    const t = setTimeout(() => {
      fetchData({ lat: centerRef.current[0], lng: centerRef.current[1], q: query, cat: category, rating: minRating, rad: radius });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, minRating, radius]);

  function handleLocateMe() {
    if (!('geolocation' in navigator)) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        setUserLocation(c);
        setGeoDenied(false);
        setGeoBusy(false);
        fetchData({ lat: c[0], lng: c[1], q: query, cat: category, rating: minRating, rad: radius });
      },
      () => { setGeoDenied(true); setGeoBusy(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  const masterMarkers: MapMarker[] = useMemo(
    () =>
      masters
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => ({
          lat: m.latitude!,
          lng: m.longitude!,
          name: m.display_name ?? m.profiles?.full_name ?? 'Master',
          rating: Number(m.rating ?? 0),
          specialization: m.specialization ?? undefined,
          masterId: m.id,
        })),
    [masters],
  );

  const salonPinMarkers: SalonMarker[] = useMemo(
    () =>
      salons
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          lat: s.latitude!,
          lng: s.longitude!,
          name: s.name ?? 'Салон',
          salonId: s.id,
        })),
    [salons],
  );

  const selectedMaster = selectedMasterId ? masters.find((m) => m.id === selectedMasterId) ?? null : null;
  const activeFilters = (category !== 'all' ? 1 : 0) + (minRating > 0 ? 1 : 0) + (radius !== 'any' ? 1 : 0);
  const totalResults = masters.length + salons.length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Search bar + toggle */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border/50 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('placeholder')}
              className="w-full h-11 rounded-xl bg-muted/50 border border-border/50 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="clear"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              'relative flex size-11 items-center justify-center rounded-xl border border-border/50 bg-muted/30 transition-colors hover:bg-muted/50',
              filtersOpen && 'bg-foreground text-background border-transparent',
            )}
            aria-label={t('filters')}
          >
            <SlidersHorizontal className="size-4" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {activeFilters}
              </span>
            )}
          </button>

          <button
            onClick={handleLocateMe}
            disabled={geoBusy}
            className="flex size-11 items-center justify-center rounded-xl border border-border/50 bg-muted/30 transition-colors hover:bg-muted/50 disabled:opacity-50"
            aria-label={t('locateMe')}
          >
            {geoBusy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          </button>
        </div>

        {/* List/Map toggle */}
        <div className="inline-flex rounded-full border border-border/50 bg-muted/30 p-0.5">
          {(['list', 'map'] as const).map((mode) => {
            const Icon = mode === 'list' ? List : MapIcon;
            return (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  view === mode ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {t(`${mode}View`)}
              </button>
            );
          })}

          {!loading && (
            <span className="ml-2 flex items-center pr-3 text-[11px] text-muted-foreground tabular-nums">
              {totalResults}
            </span>
          )}
        </div>

        {/* Filters panel */}
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-1">
                {/* Category */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('category')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setCategory(key)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          category === key
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                        )}
                      >
                        {tInd(key)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('rating')}
                  </p>
                  <div className="flex gap-1.5">
                    {([
                      { v: 0, label: t('anyRating') },
                      { v: 4, label: '4.0+' },
                      { v: 4.5, label: '4.5+' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        onClick={() => setMinRating(opt.v)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors',
                          minRating === opt.v
                            ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'border-border/60 text-muted-foreground hover:border-amber-300',
                        )}
                      >
                        {opt.v > 0 && <Star className="size-3 fill-amber-400 text-amber-400" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Radius */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('distance')}
                  </p>
                  <div className="flex gap-1.5">
                    {RADIUS_PRESETS.map((r) => (
                      <button
                        key={r.key}
                        onClick={() => setRadius(r.key)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          radius === r.key
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                        )}
                      >
                        {r.key === 'any' ? t('anyDistance') : r.key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {geoDenied && !geoBusy && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Navigation className="size-3" />
            {t('enableGeoHint')}
          </p>
        )}
      </div>

      {/* Results */}
      {view === 'list' ? (
        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : totalResults === 0 && hasSearched ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <SearchIcon className="size-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">{t('nothingFound')}</p>
              <p className="mt-1 text-xs">{t('tryDifferent')}</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {masters.map((m, i) => (
                  <motion.div
                    key={`m-${m.id}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.03, 0.2) } }}
                    exit={{ opacity: 0, scale: 0.97 }}
                  >
                    <ResultCard
                      master={toMasterRef(m)}
                      salon={toSalonRef(m.salon)}
                      city={m.city ?? m.salon?.city ?? null}
                      href={`/masters/${m.id}`}
                      labels={{
                        masterPlaceholder: tCard('masterPlaceholder'),
                        salonPlaceholder: tCard('salonPlaceholder'),
                        managerAssigned: tCard('managerAssigned'),
                      }}
                    />
                  </motion.div>
                ))}

                {salons.map((s, i) => (
                  <motion.div
                    key={`s-${s.id}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min((masters.length + i) * 0.03, 0.2) } }}
                    exit={{ opacity: 0, scale: 0.97 }}
                  >
                    <ResultCard
                      master={null}
                      salon={toSalonRef(s)}
                      city={s.city ?? null}
                      href={s.slug ? `/s/${s.slug}` : `/s/${s.id}`}
                      labels={{
                        masterPlaceholder: tCard('masterPlaceholder'),
                        salonPlaceholder: tCard('salonPlaceholder'),
                        managerAssigned: tCard('managerAssigned'),
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="relative flex-1 mx-4 mb-4 rounded-2xl overflow-hidden border border-border/50 shadow-sm min-h-[420px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}
          <MapView
            markers={masterMarkers}
            salonMarkers={salonPinMarkers}
            center={center}
            zoom={13}
            className="h-full w-full"
            onMarkerClick={(id) => setSelectedMasterId(id)}
            onSalonClick={(id) => {
              const s = salons.find((x) => x.id === id);
              router.push(s?.slug ? `/s/${s.slug}` : `/s/${id}`);
            }}
            userLocation={userLocation}
          />

          {!loading && (
            <div className="absolute top-3 left-3 z-[500] rounded-full bg-background/85 backdrop-blur-md border border-border/50 px-3 py-1.5 text-xs font-medium shadow-sm tabular-nums">
              {masterMarkers.length} · {salonPinMarkers.length}
            </div>
          )}

          <AnimatePresence>
            {selectedMaster && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute bottom-4 left-4 right-4 z-[600]"
              >
                <Link
                  href={`/masters/${selectedMaster.id}`}
                  className="group block rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-3 shadow-lg transition-all hover:shadow-xl"
                >
                  {(() => {
                    const d = resolveCardDisplay(toMasterRef(selectedMaster), toSalonRef(selectedMaster.salon), {
                      masterPlaceholder: tCard('masterPlaceholder'),
                      salonPlaceholder: tCard('salonPlaceholder'),
                      managerAssigned: tCard('managerAssigned'),
                    });
                    const Icon = d.mode === 'solo' ? MapPin : Building2;
                    return (
                      <div className="flex items-center gap-3">
                        <AvatarRing src={d.avatarSrc} name={d.avatarName} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                            <p className="truncate font-semibold">{d.primary}</p>
                          </div>
                          {d.secondary && (
                            <p className="truncate text-xs text-muted-foreground">{d.secondary}</p>
                          )}
                          {d.rating != null && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Star className="size-3 fill-amber-400 text-amber-400" />
                              <span className="tabular-nums">{d.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    );
                  })()}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

interface ResultCardProps {
  master: MasterRef | null;
  salon: SalonRef | null;
  city: string | null;
  href: string;
  labels: { masterPlaceholder: string; salonPlaceholder: string; managerAssigned: string };
}

function ResultCard({ master, salon, city, href, labels }: ResultCardProps) {
  const router = useRouter();
  const d = resolveCardDisplay(master, salon, labels);
  const Icon = d.mode === 'solo' ? MapPin : Building2;
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleFollow(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      let res: Response;
      if (master?.id) {
        res = await fetch('/api/follow/crm/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masterId: master.id }),
        });
      } else if (salon?.id) {
        res = await fetch(`/api/salon/${salon.id}/follow`, {
          method: following ? 'DELETE' : 'POST',
        });
      } else {
        return;
      }
      if (res.status === 401) {
        router.push('/ru/login');
        return;
      }
      if (!res.ok) {
        toast.error('Не удалось обновить контакты');
        return;
      }
      setFollowing(!following);
      toast.success(!following ? 'Добавлено в контакты' : 'Удалено из контактов');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(href); }}
      className="group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <AvatarRing src={d.avatarSrc} name={d.avatarName} size={56} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <h3 className="truncate font-semibold group-hover:text-primary transition-colors">
              {d.primary}
            </h3>
          </div>
          {d.secondary && (
            <p className="truncate text-sm text-muted-foreground">{d.secondary}</p>
          )}

          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            {d.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="tabular-nums">{d.rating.toFixed(1)}</span>
              </span>
            )}
            {city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {city}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleFollow}
          disabled={busy}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
            following
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5',
            busy && 'opacity-50',
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : following ? (
            <Check className="size-3.5" />
          ) : (
            <UserPlus className="size-3.5" />
          )}
          {following ? 'В контактах' : 'В контакты'}
        </button>
      </div>
    </div>
  );
}
