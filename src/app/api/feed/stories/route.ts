/** --- YAML
 * name: Feed Stories API
 * description: GET /api/feed/stories → top masters ranked by score mixer (rating + recent post likes + freshness + same-city bonus). Returns up to 20 items for Instagram-style stories row.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LIMIT = 20;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const cityParam = searchParams.get('city');

  let viewerCity: string | null = cityParam;
  if (!viewerCity && user) {
    const { data: me } = await supabase.from('profiles').select('city').eq('id', user.id).maybeSingle();
    viewerCity = me?.city ?? null;
  }

  const { data: masters } = await supabase
    .from('masters')
    .select('id, profile_id, city, rating, total_reviews, avatar_url, profile:profiles!masters_profile_id_fkey(full_name, avatar_url, public_id, posts_count)')
    .eq('is_active', true)
    .order('rating', { ascending: false })
    .limit(60);

  if (!masters || masters.length === 0) {
    return NextResponse.json({ stories: [] });
  }

  type Row = {
    id: string;
    profile_id: string;
    city: string | null;
    rating: number | null;
    total_reviews: number | null;
    avatar_url: string | null;
    profile: { full_name: string | null; avatar_url: string | null; public_id: string | null; posts_count: number | null } | { full_name: string | null; avatar_url: string | null; public_id: string | null; posts_count: number | null }[] | null;
  };

  const rows = masters as unknown as Row[];
  const profileIds = rows.map((m) => m.profile_id);

  // Recent likes (last 7 days) grouped by author
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('author_id, likes_count, created_at')
    .in('author_id', profileIds)
    .gte('created_at', since);

  const likesByAuthor = new Map<string, number>();
  const lastPostByAuthor = new Map<string, number>();
  for (const p of (recentPosts ?? []) as { author_id: string; likes_count: number | null; created_at: string }[]) {
    likesByAuthor.set(p.author_id, (likesByAuthor.get(p.author_id) ?? 0) + (p.likes_count ?? 0));
    const t = new Date(p.created_at).getTime();
    if (!lastPostByAuthor.has(p.author_id) || t > (lastPostByAuthor.get(p.author_id) ?? 0)) {
      lastPostByAuthor.set(p.author_id, t);
    }
  }

  const now = Date.now();
  const scored = rows.map((m) => {
    const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    const likes7d = likesByAuthor.get(m.profile_id) ?? 0;
    const rating = Number(m.rating ?? 0);
    const lastPost = lastPostByAuthor.get(m.profile_id);
    const daysSince = lastPost ? (now - lastPost) / 86400000 : 30;
    const recencyBonus = Math.max(0, 7 - daysSince);
    const cityBonus = viewerCity && m.city && m.city.toLowerCase() === viewerCity.toLowerCase() ? 8 : 0;
    const score = likes7d * 2 + rating * 10 + recencyBonus + cityBonus;
    return {
      id: m.id,
      publicId: prof?.public_id ?? null,
      name: prof?.full_name ?? 'Мастер',
      avatar: prof?.avatar_url ?? m.avatar_url ?? null,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const stories = scored.slice(0, LIMIT).map(({ id, publicId, name, avatar }) => ({ id, publicId, name, avatar }));

  return NextResponse.json({ stories });
}
