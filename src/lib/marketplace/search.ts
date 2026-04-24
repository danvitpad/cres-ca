/** --- YAML
 * name: Marketplace search
 * description: Server-side helper for /search page + AI concierge. Filters by city / service
 *              keyword / price range. Returns enriched cards.
 * created: 2026-04-24
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface SearchParams {
  city?: string;
  service?: string;          // keyword to match against service.name (ILIKE)
  priceMax?: number;
  limit?: number;
  offset?: number;
  /** Latitude/longitude radius filter (km) — optional */
  near?: { lat: number; lng: number; radiusKm: number };
}

export interface MasterCard {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  city: string | null;
  specialization: string | null;
  headline: string | null;
  rating: number | null;
  reviewsCount: number;
  topServices: Array<{ name: string; price: number; currency: string }>;
  distanceKm?: number;
}

export async function searchMasters(params: SearchParams): Promise<MasterCard[]> {
  const db = admin();
  const limit = Math.min(params.limit ?? 50, 100);

  // Stage 1: masters (filtered by city + public)
  let q = db
    .from('masters')
    .select(
      'id, slug, specialization, city, latitude, longitude, headline, ' +
      'profile:profiles!masters_profile_id_fkey(full_name, first_name, avatar_url)',
    )
    .eq('is_public', true)
    .eq('is_active', true)
    .limit(limit);

  if (params.city) {
    q = q.ilike('city', `%${params.city.trim()}%`);
  }

  const { data: masters } = await q;
  if (!masters?.length) return [];

  type MRow = {
    id: string;
    slug: string;
    specialization: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    headline: string | null;
    profile: { full_name: string | null; first_name: string | null; avatar_url: string | null } | null;
  };
  let rows = masters as unknown as MRow[];

  // Stage 2: service keyword filter — if specified, only keep masters with matching service
  if (params.service && params.service.trim()) {
    const { data: svcMatches } = await db
      .from('services')
      .select('master_id')
      .in('master_id', rows.map((r) => r.id))
      .eq('is_active', true)
      .ilike('name', `%${params.service.trim()}%`);
    const ids = new Set((svcMatches ?? []).map((s) => s.master_id as string));
    rows = rows.filter((r) => ids.has(r.id));
  }

  // Stage 3: price-cap filter
  if (params.priceMax && params.priceMax > 0) {
    const { data: svcMatches } = await db
      .from('services')
      .select('master_id')
      .in('master_id', rows.map((r) => r.id))
      .eq('is_active', true)
      .lte('price', params.priceMax);
    const ids = new Set((svcMatches ?? []).map((s) => s.master_id as string));
    rows = rows.filter((r) => ids.has(r.id));
  }

  if (rows.length === 0) return [];

  // Stage 4: enrich — ratings + top services
  const [ratingsRes, servicesRes] = await Promise.all([
    db.from('master_ratings')
      .select('master_id, reviews_count, average_score')
      .in('master_id', rows.map((r) => r.id)),
    db.from('services')
      .select('master_id, name, price, currency')
      .in('master_id', rows.map((r) => r.id))
      .eq('is_active', true)
      .order('price', { ascending: true })
      .limit(rows.length * 3),
  ]);

  const ratingMap = new Map<string, { count: number; avg: number | null }>();
  for (const r of ((ratingsRes.data ?? []) as Array<{ master_id: string; reviews_count: number; average_score: number | null }>)) {
    ratingMap.set(r.master_id, { count: r.reviews_count ?? 0, avg: r.average_score });
  }
  const svcByMaster = new Map<string, Array<{ name: string; price: number; currency: string }>>();
  for (const s of ((servicesRes.data ?? []) as Array<{ master_id: string; name: string; price: number; currency: string }>)) {
    const arr = svcByMaster.get(s.master_id) ?? [];
    if (arr.length < 3) arr.push({ name: s.name, price: Number(s.price), currency: s.currency });
    svcByMaster.set(s.master_id, arr);
  }

  let cards: MasterCard[] = rows.map((r) => {
    const fullName = r.profile?.full_name ?? r.profile?.first_name ?? 'Мастер';
    const firstName = r.profile?.first_name ?? fullName.split(' ')[0] ?? 'Мастер';
    const rating = ratingMap.get(r.id);
    const card: MasterCard = {
      id: r.id,
      slug: r.slug,
      fullName,
      firstName,
      avatarUrl: r.profile?.avatar_url ?? null,
      city: r.city,
      specialization: r.specialization,
      headline: r.headline,
      rating: rating?.avg ?? null,
      reviewsCount: rating?.count ?? 0,
      topServices: svcByMaster.get(r.id) ?? [],
    };
    if (params.near && r.latitude != null && r.longitude != null) {
      card.distanceKm = haversine(params.near.lat, params.near.lng, r.latitude, r.longitude);
    }
    return card;
  });

  // Stage 5: geo radius filter
  if (params.near) {
    cards = cards.filter((c) => c.distanceKm !== undefined && c.distanceKm <= params.near!.radiusKm);
  }

  // Sort: rating desc, reviews desc, then distance asc
  cards.sort((a, b) => {
    const aRat = a.rating ?? 0;
    const bRat = b.rating ?? 0;
    if (aRat !== bRat) return bRat - aRat;
    if (a.reviewsCount !== b.reviewsCount) return b.reviewsCount - a.reviewsCount;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });

  return cards;
}

/** Haversine distance in km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
