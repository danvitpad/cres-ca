/** --- YAML
 * name: Telegram Nearby API
 * description: Returns masters and salons near given coordinates. Uses admin client to bypass RLS.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const RADIUS_DEG = 0.15;

export async function POST(request: Request) {
  const { lat, lng } = await request.json();
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'invalid_coords' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

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
