/** --- YAML
 * name: Universal Follow List
 * description: GET ?profileId=X&type=followers|following|mutual → lists profiles with entity type (client/master/salon).
 * created: 2026-04-14
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  // Admin client — bypasses cookie-dependent RLS. Safe here because the
  // endpoint only returns PUBLIC follow-graph data (follower/following
  // profile + entity type). Called from Mini App where Supabase cookies
  // don't survive the Telegram Webview.
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  const type = searchParams.get('type');

  if (!profileId) return NextResponse.json({ error: 'missing_profile_id' }, { status: 400 });
  if (type !== 'followers' && type !== 'following' && type !== 'mutual') {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }

  let ids: string[] = [];
  const createdAtMap = new Map<string, string>();

  if (type === 'mutual') {
    // Mutual: both directions exist
    // Get people who follow profileId
    const { data: followersRows } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', profileId)
      .order('created_at', { ascending: false })
      .limit(500);

    const followerIds = new Set((followersRows ?? []).map(r => r.follower_id));

    // Get people profileId follows
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profileId)
      .limit(500);

    const followingIds = new Set((followingRows ?? []).map(r => r.following_id));

    // Intersection = mutual
    for (const r of (followersRows ?? [])) {
      if (followingIds.has(r.follower_id)) {
        ids.push(r.follower_id);
        createdAtMap.set(r.follower_id, r.created_at);
      }
    }
  } else {
    const selectCol = type === 'followers' ? 'follower_id' : 'following_id';
    const filterCol = type === 'followers' ? 'following_id' : 'follower_id';

    const { data: rows, error } = await supabase
      .from('follows')
      .select(`${selectCol}, created_at`)
      .eq(filterCol, profileId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ids = (rows ?? []).map((r: any) => r[selectCol]).filter(Boolean) as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rows ?? []).forEach((r: any) => createdAtMap.set(r[selectCol], r.created_at));
  }

  if (ids.length === 0) return NextResponse.json({ list: [] });

  // Load profiles with entity type resolution
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, phone, email')
    .in('id', ids);

  // Resolve entity types: check masters and salons tables
  const { data: masters } = await supabase
    .from('masters')
    .select('id, profile_id, display_name, specialization, city, avatar_url')
    .in('profile_id', ids);

  const { data: salons } = await supabase
    .from('salons')
    .select('id, owner_id, name, city, logo_url')
    .in('owner_id', ids);

  const masterByProfile = new Map((masters ?? []).map(m => [m.profile_id, m]));
  const salonByOwner = new Map((salons ?? []).map(s => [s.owner_id, s]));

  // If type=followers, check which ones the profileId follows back (for mutual detection)
  let followingBackSet = new Set<string>();
  if (type === 'followers') {
    const { data: followingBack } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profileId)
      .in('following_id', ids);
    followingBackSet = new Set((followingBack ?? []).map(r => r.following_id));
  }

  const order = new Map(ids.map((id, i) => [id, i]));
  const list = (profiles ?? [])
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(p => {
      const master = masterByProfile.get(p.id);
      const salon = salonByOwner.get(p.id);
      const entityType = salon ? 'salon' : master ? 'master' : 'client';

      return {
        profileId: p.id,
        fullName: p.full_name,
        avatarUrl: master?.avatar_url || p.avatar_url,
        role: p.role,
        phone: p.phone,
        email: p.email,
        entityType,
        entityMeta: entityType === 'master'
          ? { masterId: master!.id, displayName: master!.display_name, specialization: master!.specialization, city: master!.city }
          : entityType === 'salon'
            ? { salonId: salon!.id, salonName: salon!.name, city: salon!.city, logoUrl: salon!.logo_url }
            : null,
        followedAt: createdAtMap.get(p.id) ?? null,
        mutual: type === 'mutual' ? true : type === 'followers' ? followingBackSet.has(p.id) : false,
      };
    });

  return NextResponse.json({ list });
}
