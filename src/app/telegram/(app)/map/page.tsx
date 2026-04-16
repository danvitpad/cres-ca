/** --- YAML
 * name: MiniAppMapPage
 * description: Mini App map — masters nearby, Telegram LocationManager first then browser/IP fallback. Uses shared Leaflet MapView.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Loader2, Star, ChevronRight, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getLocation } from '@/lib/telegram/geolocation';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import type { MapMarker, SalonMarker } from '@/components/shared/map-view';

const MapView = dynamic(() => import('@/components/shared/map-view'), { ssr: false });

interface MasterRow {
  id: string;
  specialization: string | null;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  display_name: string | null;
  avatar_url: string | null;
  full_name: string | null;
}

const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234]; // Kyiv
const RADIUS_DEG = 0.15;

export default function MiniAppMapPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [salonMarkers, setSalonMarkers] = useState<SalonMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [selected, setSelected] = useState<MasterRow | null>(null);
  const [query, setQuery] = useState('');

  const fetchMasters = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    const supabase = createClient();
    const [mastersRes, salonsRes] = await Promise.all([
      supabase
        .from('masters')
        .select('id, specialization, rating, latitude, longitude, display_name, avatar_url, profile:profiles(full_name)')
        .eq('is_active', true)
        .gte('latitude', lat - RADIUS_DEG)
        .lte('latitude', lat + RADIUS_DEG)
        .gte('longitude', lng - RADIUS_DEG)
        .lte('longitude', lng + RADIUS_DEG)
        .limit(50),
      supabase
        .from('salons')
        .select('id, name, address, latitude, longitude')
        .gte('latitude', lat - RADIUS_DEG)
        .lte('latitude', lat + RADIUS_DEG)
        .gte('longitude', lng - RADIUS_DEG)
        .lte('longitude', lng + RADIUS_DEG)
        .limit(50),
    ]);
    const data = mastersRes.data;
    const salonsData = (salonsRes.data ?? []) as Array<{
      id: string;
      name: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    }>;

    setSalonMarkers(
      salonsData
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          lat: s.latitude!,
          lng: s.longitude!,
          name: s.name ?? 'Салон',
          address: s.address ?? undefined,
          salonId: s.id,
        })),
    );

    const rows: MasterRow[] = (data ?? []).map((m: unknown) => {
      const row = m as {
        id: string;
        specialization: string | null;
        rating: number | null;
        latitude: number | null;
        longitude: number | null;
        display_name: string | null;
        avatar_url: string | null;
        profile: { full_name: string | null } | { full_name: string | null }[] | null;
      };
      const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return {
        id: row.id,
        specialization: row.specialization,
        rating: row.rating,
        latitude: row.latitude,
        longitude: row.longitude,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        full_name: p?.full_name ?? null,
      };
    });

    setMasters(rows);
    setMarkers(
      rows
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => ({
          lat: m.latitude!,
          lng: m.longitude!,
          name: m.display_name ?? m.full_name ?? 'Мастер',
          rating: Number(m.rating ?? 0),
          specialization: m.specialization ?? undefined,
          masterId: m.id,
        })),
    );
    setLoading(false);
  }, []);

  const locate = useCallback(
    async (interactive: boolean) => {
      setGeoBusy(true);
      if (interactive) haptic('light');
      try {
        const pos = await getLocation();
        if (pos) {
          const coords: [number, number] = [pos.lat, pos.lng];
          setCenter(coords);
          setUserLocation(coords);
          setGeoDenied(false);
          await fetchMasters(pos.lat, pos.lng);
          if (interactive) haptic('success');
          return;
        }
      } catch {
        // geolocation failed, try IP fallbacks
      }

      // IP-level fallback — try multiple services
      const ipServices = [
        async () => {
          const r = await fetch('https://ipwho.is/', { cache: 'no-store' });
          const j = await r.json();
          if (typeof j.latitude === 'number' && typeof j.longitude === 'number') {
            return { lat: j.latitude, lng: j.longitude };
          }
          return null;
        },
        async () => {
          const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
          const j = await r.json();
          if (typeof j.latitude === 'number' && typeof j.longitude === 'number') {
            return { lat: j.latitude, lng: j.longitude };
          }
          return null;
        },
        async () => {
          const r = await fetch('https://ip-api.com/json/?fields=lat,lon', { cache: 'no-store' });
          const j = await r.json();
          if (typeof j.lat === 'number' && typeof j.lon === 'number') {
            return { lat: j.lat, lng: j.lon };
          }
          return null;
        },
      ];

      for (const svc of ipServices) {
        try {
          const result = await svc();
          if (result) {
            const coords: [number, number] = [result.lat, result.lng];
            setCenter(coords);
            setUserLocation(coords);
            setGeoDenied(true);
            await fetchMasters(result.lat, result.lng);
            return;
          }
        } catch {
          // try next service
        }
      }

      setGeoDenied(true);
      await fetchMasters(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      if (interactive) haptic('warning');
    },
    [fetchMasters, haptic],
  );

  useEffect(() => {
    locate(false);
  }, [locate]);

  function handleMarkerClick(masterId: string) {
    const m = masters.find((x) => x.id === masterId);
    if (m) {
      setSelected(m);
      haptic('selection');
    }
  }

  const filteredMarkers = query.trim()
    ? markers.filter((m) => {
        const q = query.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.specialization ?? '').toLowerCase().includes(q)
        );
      })
    : markers;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search bar + locate */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm">
          <Search className="size-4 text-white/50 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск мастера, услуги…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/50">
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => locate(true)}
          disabled={geoBusy}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 active:scale-[0.95] transition-transform disabled:opacity-60"
        >
          {geoBusy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
        </button>
      </div>

      {/* Map */}
      <div className="relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <Loader2 className="size-7 animate-spin text-white/80" />
          </div>
        )}
        <MapView
          markers={filteredMarkers}
          salonMarkers={salonMarkers}
          center={center}
          zoom={13}
          className="size-full"
          onMarkerClick={handleMarkerClick}
          onSalonClick={(salonId) => router.push(`/telegram/salon/${salonId}`)}
          userLocation={userLocation}
        />

        {!loading && (
          <div className="absolute left-3 top-3 z-[500] rounded-full bg-[#1f2023]/80 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md">
            {filteredMarkers.length} мастеров · {salonMarkers.length} салонов
          </div>
        )}

        {geoDenied && !geoBusy && (
          <div className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-200 backdrop-blur-md">
            <Navigation className="size-3" /> Разрешите доступ к геолокации
          </div>
        )}
      </div>

      {/* Selected master card */}
      <AnimatePresence>
        {selected && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={() => router.push(`/telegram/search/${selected.id}`)}
            className="mx-4 mb-3 mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-left backdrop-blur-xl active:scale-[0.98] transition-transform"
          >
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 text-base font-bold">
              {selected.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                (selected.display_name ?? selected.full_name ?? 'M')[0]
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {selected.display_name ?? selected.full_name ?? 'Мастер'}
              </p>
              {selected.specialization && (
                <p className="truncate text-[11px] text-white/60">{selected.specialization}</p>
              )}
              <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-amber-300">
                <Star className="size-2.5 fill-amber-400" />
                {Number(selected.rating ?? 0).toFixed(1)}
              </div>
            </div>
            <ChevronRight className="size-5 text-white/50" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
