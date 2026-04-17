/** --- YAML
 * name: Telegram Master Clients API
 * description: Returns clients of the master who owns the validated Telegram session.
 *              Used by /telegram/m/clients page — Supabase JWT cookies don't persist
 *              in Telegram WebView, so we validate via initData HMAC + service-role.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData } = await request.json().catch(() => ({}));
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

  // Resolve master by telegram_id → profile → master
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ clients: [], masterId: null });
  }

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) {
    return NextResponse.json({ clients: [], masterId: null });
  }

  const { data: clients, error } = await admin
    .from('clients')
    .select('id, full_name, phone, total_visits, total_spent, last_visit_at, has_health_alert, behavior_indicators')
    .eq('master_id', master.id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: clients ?? [], masterId: master.id });
}
