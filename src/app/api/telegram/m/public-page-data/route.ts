/** --- YAML
 * name: Telegram Master Public Page Data API
 * description: Возвращает полный набор данных публичной страницы мастера для
 *              Mini App native превью: master row (со всеми полями cover/workplace/
 *              address/phone/instagram/счётчиками), услуги, портфолио, email из
 *              profile. В Mini App нет cookie supabase session, поэтому browser
 *              client упирается в RLS — этот endpoint валидирует через initData
 *              (resolveUserId) и читает service-role клиентом.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
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
    .select('email')
    .eq('id', userId)
    .maybeSingle<{ email: string | null }>();

  const { data: master } = await admin
    .from('masters')
    .select(
      'id, display_name, specialization, bio, city, rating, total_reviews, ' +
      'avatar_url, cover_url, invite_code, workplace, address, phone, instagram, ' +
      'total_appointments, total_clients',
    )
    .eq('profile_id', userId)
    .maybeSingle<{ id: string; [k: string]: unknown }>();

  if (!master) {
    return NextResponse.json({ master: null, profile: profile ?? null, services: [], portfolio: [] });
  }

  const [{ data: services }, { data: portfolio }] = await Promise.all([
    admin
      .from('services')
      .select('id, name, duration_minutes, price, currency, color')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('price', { ascending: false }),
    admin
      .from('portfolio_items')
      .select('id, image_url, caption')
      .eq('master_id', master.id)
      .order('sort_order', { ascending: true })
      .limit(12),
  ]);

  return NextResponse.json({
    master,
    profile: profile ?? null,
    services: services ?? [],
    portfolio: portfolio ?? [],
  });
}
