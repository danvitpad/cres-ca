/** --- YAML
 * name: Fetch public master by slug
 * description: Server-only. Returns rich master profile for /m/[slug] including services,
 *              published reviews (paginated), aggregate rating, city, schema.org data.
 * created: 2026-04-24
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface PublicMaster {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  headline: string | null;
  specialization: string | null;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: {
    average: number | null;
    count: number;
  };
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    duration: number;
    price: number;
    currency: string;
    requiresPrepayment: boolean;
  }>;
  reviews: Array<{
    id: string;
    score: number;
    comment: string | null;
    createdAt: string;
    reviewerName: string;  // first name only for privacy
  }>;
}

export async function getPublicMasterBySlug(slug: string): Promise<PublicMaster | null> {
  const db = admin();

  const { data: master } = await db
    .from('masters')
    .select(
      'id, slug, specialization, city, bio, latitude, longitude, headline, is_public, is_active, profile_id, ' +
      'profile:profiles!masters_profile_id_fkey(full_name, first_name, avatar_url)',
    )
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('is_active', true)
    .maybeSingle();

  type MRow = {
    id: string;
    slug: string;
    specialization: string | null;
    city: string | null;
    bio: string | null;
    latitude: number | null;
    longitude: number | null;
    headline: string | null;
    is_public: boolean;
    is_active: boolean;
    profile_id: string;
    profile: { full_name: string | null; first_name: string | null; avatar_url: string | null } | null;
  };
  const m = master as unknown as MRow | null;
  if (!m) return null;

  // Gate on active subscription (trial or paid). Expired/cancelled → hidden.
  const { data: sub } = await db
    .from('subscriptions')
    .select('status')
    .eq('profile_id', m.profile_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub || !['active', 'trial'].includes(sub.status as string)) {
    return null;
  }

  const [servicesRes, reviewsRes, ratingRes] = await Promise.all([
    db.from('services')
      .select('id, name, description, duration_minutes, price, currency, requires_prepayment')
      .eq('master_id', m.id)
      .eq('is_active', true)
      .order('price', { ascending: true }),
    db.from('reviews')
      .select('id, score, comment, created_at, reviewer_id, ' +
        'profile:profiles!reviews_reviewer_id_fkey(first_name, full_name)')
      .eq('target_type', 'master')
      .eq('target_id', m.id)
      .eq('is_published', true)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('master_ratings')
      .select('reviews_count, average_score')
      .eq('master_id', m.id)
      .maybeSingle(),
  ]);

  type SvcRow = {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    currency: string;
    requires_prepayment: boolean;
  };
  type RevRow = {
    id: string;
    score: number;
    comment: string | null;
    created_at: string;
    profile: { first_name: string | null; full_name: string | null } | null;
  };

  const fullName = m.profile?.full_name ?? m.profile?.first_name ?? 'Мастер';
  const firstName = m.profile?.first_name ?? fullName.split(' ')[0] ?? 'Мастер';

  return {
    id: m.id,
    slug: m.slug,
    fullName,
    firstName,
    headline: m.headline,
    specialization: m.specialization,
    city: m.city,
    bio: m.bio,
    avatarUrl: m.profile?.avatar_url ?? null,
    latitude: m.latitude,
    longitude: m.longitude,
    rating: {
      average: (ratingRes.data as { average_score: number | null } | null)?.average_score ?? null,
      count: (ratingRes.data as { reviews_count: number } | null)?.reviews_count ?? 0,
    },
    services: ((servicesRes.data ?? []) as SvcRow[]).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration_minutes,
      price: Number(s.price),
      currency: s.currency,
      requiresPrepayment: s.requires_prepayment,
    })),
    reviews: ((reviewsRes.data ?? []) as unknown as RevRow[]).map((r) => {
      const reviewerFirst = r.profile?.first_name ?? r.profile?.full_name?.split(' ')[0] ?? 'Гость';
      return {
        id: r.id,
        score: r.score,
        comment: r.comment,
        createdAt: r.created_at,
        reviewerName: reviewerFirst,
      };
    }),
  };
}

/** List slugs for sitemap generation — only masters with active subscription. */
export async function listPublicMasterSlugs(limit = 5000): Promise<Array<{ slug: string; updatedAt: string }>> {
  const db = admin();
  // Join with subscriptions to gate on active/trial status — only indexable masters land in sitemap.
  const { data } = await db
    .from('masters')
    .select('slug, updated_at, profile_id, subscriptions:subscriptions!subscriptions_profile_id_fkey(status)')
    .eq('is_public', true)
    .eq('is_active', true)
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  type Row = { slug: string; updated_at: string; subscriptions: Array<{ status: string }> | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => (r.subscriptions ?? []).some((s) => ['active', 'trial'].includes(s.status)))
    .map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
}
