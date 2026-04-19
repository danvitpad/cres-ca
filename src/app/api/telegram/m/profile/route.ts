/** --- YAML
 * name: Telegram Master Profile API
 * description: Returns master self profile + subscription info + portfolio posts + aggregate stats for the mini-app Instagram-style profile screen.
 * created: 2026-04-17
 * updated: 2026-04-19
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

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ master: null, profile: null, subscription: null, posts: [], stats: null });
  }

  const [{ data: master }, { data: subscription }, { data: posts }] = await Promise.all([
    admin
      .from('masters')
      .select('id, display_name, specialization, bio, city, rating, total_reviews, avatar_url, invite_code')
      .eq('profile_id', profile.id)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('tier, status, trial_ends_at, current_period_end')
      .eq('profile_id', profile.id)
      .maybeSingle(),
    admin
      .from('posts')
      .select('id, image_url, caption, created_at')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  let stats = null as null | { appointments: number; clients: number };
  if (master) {
    const [{ count: appointmentsCount }, { count: clientsCount }] = await Promise.all([
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', master.id)
        .eq('status', 'completed'),
      admin
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', master.id),
    ]);
    stats = {
      appointments: appointmentsCount ?? 0,
      clients: clientsCount ?? 0,
    };
  }

  return NextResponse.json({ profile, master, subscription, posts: posts ?? [], stats });
}
