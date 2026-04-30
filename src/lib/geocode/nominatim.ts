/** --- YAML
 * name: Geocode (Nominatim)
 * description: Best-effort address → {lat, lng} via OpenStreetMap Nominatim API.
 *              Free, rate-limited (1 req/sec). Returns null on any failure.
 * created: 2026-04-30
 * --- */

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; city: string | null } | null> {
  if (!query || query.trim().length < 3) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'cres-ca.com/1.0 (booking platform)', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{
      lat: string;
      lon: string;
      address?: { city?: string; town?: string; village?: string; municipality?: string };
    }>;
    if (!data.length) return null;
    const top = data[0];
    const lat = Number(top.lat);
    const lng = Number(top.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const city = top.address?.city ?? top.address?.town ?? top.address?.village ?? top.address?.municipality ?? null;
    return { lat, lng, city };
  } catch {
    return null;
  }
}
