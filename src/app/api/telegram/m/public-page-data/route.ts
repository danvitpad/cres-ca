/** --- YAML
 * name: Telegram Master Public Page Data API
 * description: Возвращает данные публичной страницы мастера для Mini App native
 *              превью. Master row + услуги + портфолио + email/phone из profile +
 *              instagram из social_links. В Mini App нет cookie supabase session,
 *              поэтому browser client упирается в RLS — этот endpoint валидирует
 *              через initData и читает service-role клиентом.
 *              Поля master: используем актуальные имена из миграций
 *              (completed_appointments_count / served_clients_count / workplace_name /
 *              social_links / working_hours), а не legacy total_appointments etc.
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
    .select('email, phone, full_name, first_name, last_name, avatar_url')
    .eq('id', userId)
    .maybeSingle<{
      email: string | null; phone: string | null;
      full_name: string | null; first_name: string | null; last_name: string | null;
      avatar_url: string | null;
    }>();

  const { data: master, error: mErr } = await admin
    .from('masters')
    .select(
      'id, display_name, specialization, bio, city, rating, total_reviews, ' +
      'avatar_url, cover_url, invite_code, workplace_name, address, social_links, ' +
      'completed_appointments_count, served_clients_count, working_hours',
    )
    .eq('profile_id', userId)
    .maybeSingle<{
      id: string;
      display_name: string | null;
      specialization: string | null;
      bio: string | null;
      city: string | null;
      rating: number | null;
      total_reviews: number | null;
      avatar_url: string | null;
      cover_url: string | null;
      invite_code: string | null;
      workplace_name: string | null;
      address: string | null;
      social_links: Record<string, string | null> | null;
      completed_appointments_count: number | null;
      served_clients_count: number | null;
      working_hours: unknown;
    }>();

  if (mErr) {
    return NextResponse.json({ error: 'master_fetch_failed', detail: mErr.message }, { status: 500 });
  }

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

  // Сшиваем поля под формат, который ждёт Mini App страница: phone берём из
  // profile (нет колонки masters.phone), instagram — из master.social_links.instagram,
  // workplace = workplace_name, total_appointments = completed_appointments_count,
  // total_clients = served_clients_count.
  const masterFlat = {
    id: master.id,
    display_name:
      master.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
      profile?.full_name ||
      null,
    specialization: master.specialization,
    bio: master.bio,
    city: master.city,
    rating: Number(master.rating ?? 0),
    total_reviews: Number(master.total_reviews ?? 0),
    avatar_url: master.avatar_url || profile?.avatar_url || null,
    cover_url: master.cover_url,
    invite_code: master.invite_code,
    workplace: master.workplace_name,
    address: master.address,
    phone: profile?.phone ?? null,
    instagram: master.social_links?.instagram ?? null,
    total_appointments: Number(master.completed_appointments_count ?? 0),
    total_clients: Number(master.served_clients_count ?? 0),
    working_hours: master.working_hours,
  };

  return NextResponse.json({
    master: masterFlat,
    profile: profile ?? null,
    services: services ?? [],
    portfolio: portfolio ?? [],
  });
}
