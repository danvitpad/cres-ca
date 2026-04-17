/** --- YAML
 * name: Telegram Master Calendar API
 * description: Returns appointments for the master on a specific day. Validates initData HMAC.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, day_iso, focus_id } = await request.json().catch(() => ({}));
  if (!initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const tg = result.user;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ appointments: [], masterId: null });
  }

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) {
    return NextResponse.json({ appointments: [], masterId: null });
  }

  // Day range — client already passes the local-day-start as ISO,
  // so just use it as `from` and add 24h for `to`. Don't reset hours
  // (server is UTC, but the client's intent is "their local day").
  const from = day_iso ? new Date(day_iso) : new Date();
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);

  const { data: appointments } = await admin
    .from('appointments')
    .select(
      'id, starts_at, ends_at, status, price, notes, client_id, client:clients(profile:profiles!clients_profile_id_fkey(full_name, phone)), service:services(name, duration_minutes)',
    )
    .eq('master_id', master.id)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });

  // If focus_id provided and not in current day's list, fetch its day for redirection
  let focusedDayIso: string | null = null;
  if (focus_id) {
    const inList = appointments?.find((a) => a.id === focus_id);
    if (!inList) {
      const { data: focused } = await admin
        .from('appointments')
        .select('starts_at')
        .eq('id', focus_id)
        .maybeSingle();
      if (focused?.starts_at) focusedDayIso = focused.starts_at;
    }
  }

  return NextResponse.json({
    appointments: appointments ?? [],
    masterId: master.id,
    focusedDayIso,
  });
}
