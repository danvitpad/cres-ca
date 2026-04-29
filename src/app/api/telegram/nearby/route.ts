/** --- YAML
 * name: Telegram Nearby API
 * description: Returns masters and salons near given coordinates. Uses admin client to bypass RLS.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const RADIUS_DEG = 0.15;

export async function POST(request: Request) {
  const { lat, lng, q } = await request.json();

  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const hasQuery = typeof q === 'string' && q.trim().length >= 2;

  if (!hasCoords && !hasQuery) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const masterSelect =
    'id, specialization, rating, salon_id, latitude, longitude, display_name, avatar_url, profile:profiles!masters_profile_id_fkey(full_name), salon:salons(id, name, logo_url, city)';

  // Name-based search — ignores geo, returns matching masters + salons globally
  if (hasQuery) {
    const term = `%${q.trim()}%`;
    const [mastersRes, salonsRes] = await Promise.all([
      admin
        .from('masters')
        .select(masterSelect)
        .eq('is_active', true)
        .or(`display_name.ilike.${term},specialization.ilike.${term},city.ilike.${term}`)
        .limit(30),
      admin
        .from('salons')
        .select('id, name, logo_url, address, city, rating, latitude, longitude')
        .or(`name.ilike.${term},city.ilike.${term}`)
        .limit(30),
    ]);

    let masters = mastersRes.data ?? [];
    if (masters.length === 0) {
      // Fallback: broad fetch + client-side filter (catches profiles.full_name too)
      const fallback = await admin
        .from('masters')
        .select(masterSelect)
        .eq('is_active', true)
        .limit(200);
      const lowerQ = q.trim().toLowerCase();
      masters = (fallback.data ?? []).filter((m: Record<string, unknown>) => {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        const fullName = ((p as { full_name?: string })?.full_name ?? '').toLowerCase();
        const displayName = ((m.display_name as string) ?? '').toLowerCase();
        const spec = ((m.specialization as string) ?? '').toLowerCase();
        return fullName.includes(lowerQ) || displayName.includes(lowerQ) || spec.includes(lowerQ);
      });
    }

    return NextResponse.json({ masters, salons: salonsRes.data ?? [] });
  }

  // Geo-based search — nearby masters & salons
  const [mastersRes, salonsRes] = await Promise.all([
    admin
      .from('masters')
      .select(masterSelect)
      .eq('is_active', true)
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG)
      .limit(50),
    admin
      .from('salons')
      .select('id, name, logo_url, address, city, rating, latitude, longitude')
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG)
      .limit(50),
  ]);

  let masters = mastersRes.data ?? [];
  const salons = salonsRes.data ?? [];

  // Fallback: if no nearby masters found, fetch all active masters regardless of location
  if (masters.length === 0) {
    const fallback = await admin
      .from('masters')
      .select(masterSelect)
      .eq('is_active', true)
      .limit(50);
    masters = fallback.data ?? [];
  }

  return NextResponse.json({ masters, salons });
}
