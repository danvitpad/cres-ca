/** --- YAML
 * name: Booking Upsell
 * description: >
 *   GET /api/telegram/c/upsell?master_id=X&service_id=Y — returns up to 2
 *   services frequently booked on the same day by the same client with this
 *   master alongside service Y. Pure statistical — no AI, no auth required
 *   (public data: only service names/prices for this master).
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const masterId = searchParams.get('master_id');
  const serviceId = searchParams.get('service_id');
  if (!masterId || !serviceId) {
    return NextResponse.json({ suggestions: [] });
  }

  const adm = admin();

  // Find clients who have booked service_id with this master (completed)
  const { data: baseApts } = await adm
    .from('appointments')
    .select('client_id, starts_at')
    .eq('master_id', masterId)
    .eq('service_id', serviceId)
    .eq('status', 'completed')
    .order('starts_at', { ascending: false })
    .limit(100);

  if (!baseApts?.length) return NextResponse.json({ suggestions: [] });

  // For each base appointment, find same-day same-master other appointments
  const coServiceCounts: Record<string, number> = {};
  const seen = new Set<string>();

  for (const apt of baseApts) {
    const dayStr = apt.starts_at.slice(0, 10);
    const key = `${apt.client_id}:${dayStr}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const dayStart = `${dayStr}T00:00:00.000Z`;
    const dayEnd = `${dayStr}T23:59:59.999Z`;

    const { data: sameDay } = await adm
      .from('appointments')
      .select('service_id')
      .eq('master_id', masterId)
      .eq('client_id', apt.client_id)
      .eq('status', 'completed')
      .neq('service_id', serviceId)
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd);

    if (sameDay) {
      for (const a of sameDay) {
        if (a.service_id) {
          coServiceCounts[a.service_id] = (coServiceCounts[a.service_id] ?? 0) + 1;
        }
      }
    }
  }

  const topIds = Object.entries(coServiceCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([id]) => id);

  if (!topIds.length) return NextResponse.json({ suggestions: [] });

  const { data: services } = await adm
    .from('services')
    .select('id, name, price, currency, duration_minutes')
    .in('id', topIds)
    .eq('is_active', true);

  return NextResponse.json({ suggestions: services ?? [] });
}
