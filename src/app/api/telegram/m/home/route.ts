/** --- YAML
 * name: Telegram Master Home API
 * description: Returns master+profile context + day stats for the Telegram mini-app home screen.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
  // Принимаем оба варианта auth: cookie session (browser) или TG initData.
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ master: null, profile: null });
  }

  const { data: master } = await admin
    .from('masters')
    .select('id, is_busy, busy_until, vertical')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) {
    return NextResponse.json({ master: null, profile });
  }

  // Today stats — server-side UTC day boundaries
  // (close enough for KPI counts; precise per-user day handled by /calendar endpoint)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: todayApts }, { data: upcoming }, { count: voiceActions }] = await Promise.all([
    admin
      .from('appointments')
      .select('id, status, price, starts_at')
      .eq('master_id', master.id)
      .gte('starts_at', today.toISOString())
      .lt('starts_at', tomorrow.toISOString()),
    admin
      .from('appointments')
      .select('id')
      .eq('master_id', master.id)
      .gte('starts_at', tomorrow.toISOString())
      .not('status', 'in', '("cancelled","cancelled_by_client","cancelled_by_master","no_show")'),
    admin
      .from('ai_actions_log')
      .select('id', { count: 'exact', head: true })
      .eq('master_id', master.id)
      .eq('source', 'voice'),
  ]);

  const todayCount = todayApts?.length ?? 0;
  const todayRevenue = (todayApts ?? [])
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + Number(a.price ?? 0), 0);
  const upcomingCount = upcoming?.length ?? 0;

  return NextResponse.json({
    profile,
    master,
    stats: { todayCount, todayRevenue, upcomingCount },
    voiceUsed: (voiceActions ?? 0) > 0,
  });
}

export async function PATCH(request: Request) {
  const { is_busy } = await request.json().catch(() => ({}));
  if (typeof is_busy !== 'boolean') {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await admin
    .from('masters')
    .update({ is_busy })
    .eq('profile_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
