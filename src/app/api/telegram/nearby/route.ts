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

  // Name-based search — ignores geo, returns matching masters globally
  if (hasQuery) {
    const term = `%${q.trim()}%`;
    const mastersRes = await admin
      .from('masters')
      .select('id, specialization, rating, latitude, longitude, display_name, avatar_url, profile:profiles!masters_profile_id_fkey(full_name)')
      .eq('is_active', true)
      .or(`display_name.ilike.${term},profile.full_name.ilike.${term},specialization.ilike.${term}`)
      .limit(30);

    // or() on a joined column may not work in PostgREST — fallback: fetch all then filter
    let masters = mastersRes.data ?? [];
    if (masters.length === 0) {
      // Broad fetch + client-side filter as fallback
      const fallback = await admin
        .from('masters')
        .select('id, specialization, rating, latitude, longitude, display_name, avatar_url, profile:profiles!masters_profile_id_fkey(full_name)')
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

    return NextResponse.json({ masters, salons: [] });
  }

  // Geo-based search — nearby masters & salons
  const [mastersRes, salonsRes] = await Promise.all([
    admin
      .from('masters')
      .select('id, specialization, rating, latitude, longitude, display_name, avatar_url, profile:profiles!masters_profile_id_fkey(full_name)')
      .eq('is_active', true)
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG)
      .limit(50),
    admin
      .from('salons')
      .select('id, name, address, latitude, longitude')
      .gte('latitude', lat - RADIUS_DEG)
      .lte('latitude', lat + RADIUS_DEG)
      .gte('longitude', lng - RADIUS_DEG)
      .lte('longitude', lng + RADIUS_DEG)
      .limit(50),
  ]);

  return NextResponse.json({
    masters: mastersRes.data ?? [],
    salons: salonsRes.data ?? [],
  });
}
