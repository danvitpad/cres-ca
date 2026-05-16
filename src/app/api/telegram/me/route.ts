/** --- YAML
 * name: Telegram Me API
 * description: Returns full profile data for the authenticated Telegram user. Uses admin client to bypass RLS — identity proven via initData HMAC.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData } = await request.json();
  if (!initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, full_name, first_name, last_name, bio, slug, public_id, avatar_url, phone, email, date_of_birth, bonus_balance, bonus_points, followers_count, following_count',
    )
    .eq('telegram_id', result.user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'not_linked' }, { status: 404 });
  }

  // Fetch visit stats for completed appointments
  const { data: stats } = await admin
    .from('appointments')
    .select('price')
    .eq('profile_id', (profile as { id: string }).id)
    .eq('status', 'completed');

  const visitCount = stats?.length ?? 0;
  const totalSpent = stats?.reduce((sum, row) => sum + (Number((row as { price?: number }).price) || 0), 0) ?? 0;

  return NextResponse.json({ profile: { ...profile, visit_count: visitCount, total_spent: totalSpent } });
}
