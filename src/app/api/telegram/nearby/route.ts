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

  // Name-based search — multi-word AND (ловит «имя фамилия» И «фамилия имя»).
  if (hasQuery) {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // Masters: chain ilike per token across display_name OR specialization OR city
    let mastersQuery = admin.from('masters').select(masterSelect).eq('is_active', true);
    for (const t of tokens) {
      const esc = t.replace(/([%,()\\])/g, '\\$1');
      mastersQuery = mastersQuery.or(`display_name.ilike.%${esc}%,specialization.ilike.%${esc}%,city.ilike.%${esc}%`);
    }

    let salonsQuery = admin
      .from('salons')
      .select('id, name, logo_url, address, city, rating, latitude, longitude');
    for (const t of tokens) {
      const esc = t.replace(/([%,()\\])/g, '\\$1');
      salonsQuery = salonsQuery.or(`name.ilike.%${esc}%,city.ilike.%${esc}%`);
    }

    const [mastersRes, salonsRes] = await Promise.all([
      mastersQuery.limit(30),
      salonsQuery.limit(30),
    ]);

    let masters = mastersRes.data ?? [];

    // Always also do a profile-name fallback: catches ANY master whose profile.full_name
    // matches all tokens (this is the only way to find e.g. "Падалко Даниил" when
    // master's display_name is empty or different).
    const fallback = await admin
      .from('masters')
      .select(masterSelect)
      .eq('is_active', true)
      .limit(200);
    const tokenList = tokens;
    const profileMatches = (fallback.data ?? []).filter((m: Record<string, unknown>) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      const fullName = ((p as { full_name?: string })?.full_name ?? '').toLowerCase();
      const displayName = ((m.display_name as string) ?? '').toLowerCase();
      const spec = ((m.specialization as string) ?? '').toLowerCase();
      const hay = `${fullName} ${displayName} ${spec}`;
      return tokenList.every((t) => hay.includes(t));
    });

    // Merge masters + profileMatches by id (de-dup)
    const seen = new Set(masters.map((m: Record<string, unknown>) => m.id as string));
    for (const m of profileMatches) {
      if (!seen.has(m.id as string)) {
        masters.push(m);
        seen.add(m.id as string);
      }
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
