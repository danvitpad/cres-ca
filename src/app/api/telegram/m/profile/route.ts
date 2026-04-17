/** --- YAML
 * name: Telegram Master Profile API
 * description: Returns master self profile + subscription info for the mini-app profile screen.
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

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ master: null, profile: null, subscription: null });
  }

  const [{ data: master }, { data: subscription }] = await Promise.all([
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
  ]);

  return NextResponse.json({ profile, master, subscription });
}
