/** --- YAML
 * name: Home Feed API
 * description: GET /api/feed → posts from profiles the current user follows, newest first. Cursor pagination (?cursor=<created_at>). Returns 20 posts + nextCursor + viewer likes set.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PAGE = 20;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');

  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const followingIds = (follows ?? []).map((f) => f.following_id);
  if (followingIds.length === 0) {
    return NextResponse.json({ posts: [], nextCursor: null, likes: [] });
  }

  let q = supabase
    .from('posts')
    .select('id, author_id, image_url, caption, likes_count, comments_count, created_at')
    .in('author_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(PAGE + 1);

  if (cursor) q = q.lt('created_at', cursor);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });

  const hasMore = (rows ?? []).length > PAGE;
  const posts = (rows ?? []).slice(0, PAGE);
  const nextCursor = hasMore ? posts[posts.length - 1].created_at : null;

  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const safeAuthorIds = authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000'];
  const { data: authors } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, public_id, slug, role')
    .in('id', safeAuthorIds);

  // Enrich with salon data: lookup masters.salon_id → salons for any author that's a master
  type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null };
  type MasterRow = { id: string; profile_id: string; salon_id: string | null; specialization: string | null; salon: SalonEmbed | SalonEmbed[] | null };
  const { data: masterRows } = await supabase
    .from('masters')
    .select('id, profile_id, salon_id, specialization, salon:salons(id, name, logo_url, city, rating)')
    .in('profile_id', safeAuthorIds);
  const masterByProfile = new Map<string, { id: string; salon_id: string | null; specialization: string | null; salon: SalonEmbed | null }>();
  for (const m of (masterRows ?? []) as MasterRow[]) {
    const s = Array.isArray(m.salon) ? m.salon[0] ?? null : m.salon;
    masterByProfile.set(m.profile_id, { id: m.id, salon_id: m.salon_id, specialization: m.specialization, salon: s });
  }

  const authorMap = new Map(
    (authors ?? []).map((a) => {
      const m = masterByProfile.get(a.id) ?? null;
      return [
        a.id,
        {
          ...a,
          master_id: m?.id ?? null,
          salon_id: m?.salon_id ?? null,
          specialization: m?.specialization ?? null,
          salon: m?.salon ?? null,
        },
      ];
    }),
  );

  const postIds = posts.map((p) => p.id);
  const { data: viewerLikes } = postIds.length
    ? await supabase
        .from('post_likes')
        .select('post_id')
        .eq('profile_id', user.id)
        .in('post_id', postIds)
    : { data: [] };

  const likedSet = new Set((viewerLikes ?? []).map((l) => l.post_id));

  const enriched = posts.map((p) => ({
    ...p,
    author: authorMap.get(p.author_id) ?? null,
    liked_by_viewer: likedSet.has(p.id),
  }));

  return NextResponse.json({ posts: enriched, nextCursor });
}
