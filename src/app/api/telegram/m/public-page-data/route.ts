/** --- YAML
 * name: Telegram Master Public Page Data API
 * description: Полный набор данных публичной страницы мастера для Mini App native
 *              превью — то же что показывает /m/{handle} в вебе:
 *                • master row (cover, bio, address, languages, working_hours, social_links,
 *                  visibility flags phone_public/email_public/dob_public)
 *                • профиль (email, phone, dob, full_name) для слияния
 *                • услуги (через services + service_categories)
 *                • портфолио (master_portfolio)
 *                • отзывы (reviews top-50)
 *                • партнёры (master_partnerships → masters)
 *              В Mini App нет cookie supabase session, поэтому browser client
 *              упирается в RLS — этот endpoint валидирует initData и читает
 *              service-role клиентом.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

interface PartnerRow {
  id: string;
  display_name: string | null;
  specialization: string | null;
  city: string | null;
  avatar_url: string | null;
  invite_code: string | null;
}

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
    .select('email, phone, full_name, first_name, last_name, avatar_url, date_of_birth')
    .eq('id', userId)
    .maybeSingle<{
      email: string | null; phone: string | null;
      full_name: string | null; first_name: string | null; last_name: string | null;
      avatar_url: string | null; date_of_birth: string | null;
    }>();

  const { data: master, error: mErr } = await admin
    .from('masters')
    .select(
      'id, display_name, specialization, bio, city, rating, total_reviews, ' +
      'avatar_url, cover_url, invite_code, slug, workplace_name, address, latitude, longitude, social_links, ' +
      'completed_appointments_count, served_clients_count, working_hours, languages, ' +
      'phone_public, email_public, dob_public, interests, headline, level',
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
      slug: string | null;
      workplace_name: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      social_links: Record<string, string | null> | null;
      completed_appointments_count: number | null;
      served_clients_count: number | null;
      working_hours: unknown;
      languages: string[] | null;
      phone_public: boolean | null;
      email_public: boolean | null;
      dob_public: boolean | null;
      interests: string[] | null;
      headline: string | null;
      level: string | null;
    }>();

  if (mErr) {
    return NextResponse.json({ error: 'master_fetch_failed', detail: mErr.message }, { status: 500 });
  }

  if (!master) {
    return NextResponse.json({
      master: null, profile: profile ?? null,
      services: [], portfolio: [], reviews: [], partners: [],
    });
  }

  const [servicesQ, portfolioQ, reviewsQ, partnershipsQ] = await Promise.all([
    admin
      .from('services')
      .select('id, name, description, duration_minutes, price, currency, color, category:service_categories(name)')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('price', { ascending: false }),
    admin
      .from('master_portfolio')
      .select('id, image_url, caption, service_id, service:services(name), item_x, item_y, item_scale')
      .eq('master_id', master.id)
      .eq('is_published', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(24),
    admin
      .from('reviews')
      .select('id, score, comment, created_at, is_anonymous, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)')
      .eq('target_type', 'master')
      .eq('target_id', master.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('master_partnerships')
      .select('master_id, partner_id')
      .or(`master_id.eq.${master.id},partner_id.eq.${master.id}`)
      .eq('status', 'active'),
  ]);

  // Партнёры: получили ids партнёрств — теперь сами карточки.
  let partners: PartnerRow[] = [];
  const partnershipRows = (partnershipsQ.data ?? []) as Array<{ master_id: string; partner_id: string }>;
  if (partnershipRows.length > 0) {
    const otherIds = partnershipRows.map((r) => (r.master_id === master.id ? r.partner_id : r.master_id));
    const { data: partnerMasters } = await admin
      .from('masters')
      .select('id, display_name, specialization, city, avatar_url, invite_code')
      .in('id', otherIds)
      .eq('is_active', true);
    partners = ((partnerMasters as unknown) as PartnerRow[] | null) ?? [];
  }

  // Расплющиваем joined relations (PostgREST даёт array even for *-to-one).
  type SvcRow = {
    id: string; name: string; description: string | null;
    duration_minutes: number; price: number; currency: string; color: string | null;
    category: { name: string } | { name: string }[] | null;
  };
  const services = ((servicesQ.data ?? []) as SvcRow[]).map((s) => ({
    ...s,
    category: Array.isArray(s.category) ? (s.category[0] ?? null) : s.category,
  }));

  type PortfolioRowDb = {
    id: string; image_url: string; caption: string | null; service_id: string | null;
    service: { name: string } | { name: string }[] | null;
    item_x: number | null; item_y: number | null; item_scale: number | null;
  };
  const portfolio = ((portfolioQ.data ?? []) as PortfolioRowDb[]).map((r) => {
    const svc = Array.isArray(r.service) ? r.service[0] : r.service;
    return {
      id: r.id,
      image_url: r.image_url,
      caption: r.caption,
      service_name: svc?.name ?? null,
      item_x: r.item_x, item_y: r.item_y, item_scale: r.item_scale,
    };
  });

  type ReviewRowDb = {
    id: string; score: number; comment: string | null; created_at: string; is_anonymous: boolean;
    reviewer: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
  };
  const reviews = ((reviewsQ.data ?? []) as ReviewRowDb[]).map((r) => {
    const rev = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
    return {
      id: r.id,
      score: r.score,
      comment: r.comment,
      created_at: r.created_at,
      is_anonymous: r.is_anonymous,
      reviewer_name: r.is_anonymous ? null : rev?.full_name ?? null,
      reviewer_avatar: r.is_anonymous ? null : rev?.avatar_url ?? null,
    };
  });

  // Сшиваем master с profile-полями: phone/email берём из profile (не из masters),
  // visibility flags решают, показывать ли их клиенту на публичной странице.
  // Сама публичка в Mini App телефон/email НЕ показывает (они в Settings),
  // но flags нужны UI Settings чтобы тумблеры стартовали в правильном положении.
  const masterFlat = {
    id: master.id,
    display_name:
      master.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
      profile?.full_name ||
      null,
    specialization: master.specialization,
    headline: master.headline,
    bio: master.bio,
    city: master.city,
    rating: Number(master.rating ?? 0),
    total_reviews: Number(master.total_reviews ?? 0),
    avatar_url: master.avatar_url || profile?.avatar_url || null,
    cover_url: master.cover_url,
    invite_code: master.invite_code,
    slug: master.slug,
    workplace: master.workplace_name,
    address: master.address,
    latitude: master.latitude,
    longitude: master.longitude,
    social_links: master.social_links ?? {},
    languages: master.languages ?? [],
    interests: master.interests ?? [],
    working_hours: master.working_hours,
    total_appointments: Number(master.completed_appointments_count ?? 0),
    total_clients: Number(master.served_clients_count ?? 0),
    phone_public: !!master.phone_public,
    email_public: !!master.email_public,
    dob_public: !!master.dob_public,
    level: master.level,
  };

  return NextResponse.json({
    master: masterFlat,
    profile: profile ?? null,
    services,
    portfolio,
    reviews,
    partners,
  });
}
