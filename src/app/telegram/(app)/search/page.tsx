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
import { Sparkles, ArrowDown } from 'lucide-react';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, FONT_BASE } from '@/components/miniapp/design';
import { AvatarCircle } from '@/components/miniapp/shells';
import { AIChatSheet } from '@/components/miniapp/ai-chat-sheet';

const AI_PROMPTS = [
  'Запиши на маникюр на завтра',
  'Найди мастера в Печерском',
  'Напомни о коррекции бровей',
  'Что взять с собой?',
] as const;

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

  // AI consierge state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);

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
    <div
      style={{
        ...FONT_BASE,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: T.bg,
        color: T.text,
      }}
    >
      {/* Top controls — Fresha pill + AI prompts row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: `20px ${PAGE_PADDING_X}px 8px` }}>
        {/* Search pill — premium Fresha-style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: T.surface,
              borderRadius: R.pill,
              boxShadow: SHADOW.pill,
              border: `1px solid ${T.borderSubtle}`,
            }}
          >
            <Search size={20} color={T.textSecondary} strokeWidth={2.2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Мастер, услуга, салон…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                ...TYPE.body,
                color: T.text,
                fontFamily: 'inherit',
                minWidth: 0,
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{ background: 'transparent', border: 'none', color: T.textTertiary, cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  haptic('light');
                  setAiPrompt(null);
                  setAiOpen(true);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: T.accentSoft,
                  color: T.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="AI-консьерж"
              >
                <Sparkles size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setFiltersOpen(true);
            }}
            style={{
              position: 'relative',
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Фильтры"
          >
            <SlidersHorizontal size={20} color={T.text} strokeWidth={2} />
            {activeFilters > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: T.accent,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* AI prompt chips — нативное общение с консьержем */}
        {!query && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', margin: `0 -${PAGE_PADDING_X}px`, padding: `0 ${PAGE_PADDING_X}px` }}>
            <style>{`.ai-prompts::-webkit-scrollbar { display: none; }`}</style>
            <div className="ai-prompts" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {AI_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    haptic('light');
                    setAiPrompt(prompt);
                    setAiOpen(true);
                  }}
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: R.pill,
                    background: T.accentSoft,
                    border: 'none',
                    color: T.accent,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Sparkles size={13} />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List/Map switcher — текстовый pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 3,
              borderRadius: R.pill,
              background: T.bgSubtle,
              border: `1px solid ${T.borderSubtle}`,
            }}
          >
            {(['list', 'map'] as const).map((mode) => {
              const Icon = mode === 'list' ? List : MapIcon;
              const active = view === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    haptic('selection');
                    setView(mode);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: R.pill,
                    border: 'none',
                    background: active ? T.text : 'transparent',
                    color: active ? T.bg : T.textSecondary,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon size={13} />
                  {mode === 'list' ? 'Список' : 'Карта'}
                </button>
              );
            })}
          </div>
          {!loading && (
            <span style={{ ...TYPE.caption, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => locate(true)}
            disabled={geoBusy}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: geoBusy ? 'wait' : 'pointer',
              opacity: geoBusy ? 0.6 : 1,
            }}
            aria-label="Моя геолокация"
          >
            {geoBusy ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} color={T.text} />}
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
          ) : total === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '64px 0' }}>
              <Search size={36} color={T.textTertiary} style={{ opacity: 0.4 }} />
              <p style={{ ...TYPE.bodyStrong, color: T.text, marginTop: 12 }}>Ничего не найдено</p>
              <p style={{ ...TYPE.caption, marginTop: 4 }}>Попробуйте изменить запрос или фильтры</p>
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

          {!loading && (
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
                border: `1px solid ${T.borderSubtle}`,
                fontSize: 12,
                fontWeight: 700,
                color: T.text,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {markers.length} · {salonMarkers.length}
            </div>
          )}

          <AnimatePresence>
            {selected && (
              <motion.button
                type="button"
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={() => router.push(`/telegram/search/${selected.id}`)}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  right: 12,
                  zIndex: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  background: T.surface,
                  border: `1px solid ${T.borderSubtle}`,
                  borderRadius: R.md,
                  boxShadow: SHADOW.elevated,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                {(() => {
                  const d = resolveCardDisplay(toMasterRef(selected), toSalonRef(selected.salon), MINIAPP_CARD_LABELS);
                  const Icon = d.mode === 'solo' ? UserIcon : Building2;
                  return (
                    <>
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
                        {d.rating != null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 12, fontWeight: 600 }}>
                            <Star size={12} fill="#f59e0b" color="#f59e0b" />
                            <span style={{ color: T.text }}>{d.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={20} color={T.textTertiary} />
                    </>
                  );
                })()}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0 24px', color: T.text }}>
          <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>Фильтры</h3>

          <div>
            <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>Категория</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
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
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p style={{ ...TYPE.micro, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>Рейтинг</p>
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
                    {opt.label}
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
              Сбросить
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
              Показать ({total})
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
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.md,
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: SHADOW.card,
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
        {d.rating != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 12, fontWeight: 600 }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <span style={{ color: T.text }}>{d.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <ChevronRight size={18} color={T.textTertiary} />
    </button>
  );
}
