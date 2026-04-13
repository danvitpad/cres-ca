/** --- YAML
 * name: MapPage
 * description: Interactive map with nearby masters, geolocation, and search-this-area functionality
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, Navigation, Loader2, Star, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { MapMarker } from '@/components/shared/map-view';

const MapView = dynamic(() => import('@/components/shared/map-view'), { ssr: false });

interface MasterWithProfile {
  id: string;
  specialization: string | null;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  display_name: string | null;
  avatar_url: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

function mName(m: MasterWithProfile): string {
  return m.display_name ?? m.profiles?.full_name ?? 'Master';
}

const DEFAULT_CENTER: [number, number] = [50.4501, 30.5234]; // Kyiv
const RADIUS_DEG = 0.15; // ~15km bounding box

export default function MapPage() {
  const t = useTranslations('map');
  const router = useRouter();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [masters, setMasters] = useState<MasterWithProfile[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [selectedMaster, setSelectedMaster] = useState<MasterWithProfile | null>(null);

  const fetchMasters = useCallback(async (lat: number, lng: number) => {
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('masters')
      .select('id, specialization, rating, latitude, longitude, is_active, display_name, avatar_url, profiles(full_name, avatar_url)')
      .eq('is_active', true)
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG)
      .limit(50);

    const results = (data as unknown as MasterWithProfile[]) || [];
    setMasters(results);
    setMarkers(
      results
        .filter((m) => m.latitude && m.longitude)
        .map((m) => ({
          lat: m.latitude!,
          lng: m.longitude!,
          name: mName(m),
          rating: m.rating || 0,
          specialization: m.specialization || undefined,
          masterId: m.id,
        })),
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function ipFallback(): Promise<[number, number] | null> {
      try {
        const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        if (!r.ok) return null;
        const j = await r.json();
        if (typeof j.latitude === 'number' && typeof j.longitude === 'number') {
          return [j.latitude, j.longitude];
        }
      } catch {}
      return null;
    }

    async function locate() {
      setGeoLoading(true);

      // 1) Try precise browser geolocation
      const precise = await new Promise<[number, number] | null>((resolve) => {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
      });

      if (cancelled) return;

      if (precise) {
        setCenter(precise);
        setUserLocation(precise);
        setGeoDenied(false);
        fetchMasters(precise[0], precise[1]);
        setGeoLoading(false);
        return;
      }

      // 2) Fallback: IP-based approximate location (no permission needed)
      const approx = await ipFallback();
      if (cancelled) return;

      if (approx) {
        setCenter(approx);
        setUserLocation(approx);
        setGeoDenied(true); // surface hint that precise location was denied
        fetchMasters(approx[0], approx[1]);
      } else {
        setGeoDenied(true);
        fetchMasters(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      }
      setGeoLoading(false);
    }

    locate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMarkerClick(masterId: string) {
    const master = masters.find((m) => m.id === masterId);
    if (master) setSelectedMaster(master);
  }

  function handleLocateMe() {
    if (!('geolocation' in navigator)) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(newCenter);
        setUserLocation(newCenter);
        setGeoDenied(false);
        fetchMasters(newCenter[0], newCenter[1]);
        setGeoLoading(false);
      },
      () => { setGeoDenied(true); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('nearbyMasters')}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLocateMe}
          disabled={geoLoading}
          className="gap-1.5"
        >
          {geoLoading ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          <span className="hidden sm:inline">{t('searchArea')}</span>
        </Button>
      </div>

      {/* Map */}
      <div className="relative flex-1 mx-4 mb-4 rounded-2xl overflow-hidden border border-border/50 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <MapView
          markers={markers}
          center={center}
          zoom={13}
          className="h-full w-full"
          onMarkerClick={handleMarkerClick}
          userLocation={userLocation}
        />

        {/* Master count badge */}
        {!isLoading && (
          <div className="absolute top-3 left-3 z-[500] rounded-full bg-background/80 backdrop-blur-md border border-border/50 px-3 py-1.5 text-xs font-medium shadow-sm">
            {markers.length} {t('nearbyMasters').toLowerCase()}
          </div>
        )}

        {/* Geo permission hint */}
        {geoDenied && !geoLoading && (
          <div className="absolute top-3 right-3 z-[500] flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm backdrop-blur-md dark:bg-amber-950/80 dark:text-amber-100">
            <Navigation className="size-3.5" />
            {t('locationDenied')}
          </div>
        )}
      </div>

      {/* Bottom sheet - selected master card */}
      <AnimatePresence>
        {selectedMaster && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute bottom-20 left-4 right-4 z-[600]"
          >
            <div
              className="group rounded-2xl border border-border/50 bg-card/90 backdrop-blur-xl p-4 shadow-lg cursor-pointer transition-all hover:shadow-xl"
              onClick={() => router.push(`/masters/${selectedMaster.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                  {mName(selectedMaster)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{mName(selectedMaster)}</h3>
                  <p className="text-sm text-muted-foreground truncate">{selectedMaster.specialization}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{(selectedMaster.rating || 0).toFixed(1)}</span>
                </div>
                <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
