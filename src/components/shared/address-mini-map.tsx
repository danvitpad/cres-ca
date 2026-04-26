/** --- YAML
 * name: AddressMiniMap
 * description: Geocodes the master's address via Nominatim (OpenStreetMap, бесплатно,
 *              без ключа) и рендерит OSM iframe с правильным bbox — карта зумится
 *              на адрес, а не показывает мировую (как было с `?query=` без bbox).
 *              Если геокод не нашёлся — fallback на iframe с query (хотя бы на город).
 *              Lazy-загрузка координат после mount, кэш через sessionStorage по q.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';

interface Props {
  query: string; // "ул. Пушкинская 12, Харьков" или просто "Харьков"
  className?: string;
}

interface Geo {
  lat: number;
  lon: number;
  bbox?: [number, number, number, number]; // [south, north, west, east]
}

const CACHE_PREFIX = 'cres:geo:';

async function geocode(q: string): Promise<Geo | null> {
  const cached = (() => {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + q);
      if (!raw) return null;
      return JSON.parse(raw) as Geo;
    } catch { return null; }
  })();
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'ru,uk,en' } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; boundingbox?: string[] }>;
    const r = data[0];
    if (!r) return null;
    const geo: Geo = {
      lat: Number(r.lat),
      lon: Number(r.lon),
      bbox: r.boundingbox && r.boundingbox.length === 4
        ? [Number(r.boundingbox[0]), Number(r.boundingbox[1]), Number(r.boundingbox[2]), Number(r.boundingbox[3])]
        : undefined,
    };
    try {
      sessionStorage.setItem(CACHE_PREFIX + q, JSON.stringify(geo));
    } catch { /* ignore */ }
    return geo;
  } catch {
    return null;
  }
}

/** OSM embed bbox URL: bbox=west,south,east,north + &marker=lat,lon */
function buildEmbedUrl(geo: Geo): string {
  // 0.005° ≈ ~500m рамка для точечного адреса
  const padLat = 0.005;
  const padLon = 0.008;
  const south = geo.lat - padLat;
  const north = geo.lat + padLat;
  const west = geo.lon - padLon;
  const east = geo.lon + padLon;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${geo.lat}%2C${geo.lon}`;
}

export function AddressMiniMap({ query, className }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    geocode(query).then((g) => {
      if (cancelled) return;
      setGeo(g);
      setTried(true);
    });
    return () => { cancelled = true; };
  }, [query]);

  // Пока геокод грузится — серый skeleton, чтобы не было прыжка макета.
  if (!tried) {
    return <div className={className} style={{ background: '#f1f3f5' }} aria-label="Загрузка карты" />;
  }

  // Геокод не нашёлся — пустой fallback (карту не показываем, чтобы не лагать мировой)
  if (!geo) return null;

  return (
    <iframe
      title="Карта"
      src={buildEmbedUrl(geo)}
      className={className}
      loading="lazy"
      style={{ border: 0 }}
    />
  );
}
