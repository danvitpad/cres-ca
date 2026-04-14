/** --- YAML
 * name: Follow List API
 * description: GET ?profileId=X&type=followers|following → lists follower/following profiles with id, full_name, avatar_url, public_id, slug, role. Used by Mini App profile counter tap.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  const type = searchParams.get('type');

  if (!profileId) return NextResponse.json({ error: 'missing_profile_id' }, { status: 400 });
  if (type !== 'followers' && type !== 'following') {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }

  // type=followers → users who follow profileId → their ids are in follower_id, filter by following_id=profileId
  // type=following → users profileId follows → their ids are in following_id, filter by follower_id=profileId
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
  const ids = (rows ?? []).map((r: any) => r[selectCol]).filter(Boolean) as string[];
  if (ids.length === 0) return NextResponse.json({ list: [] });

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, public_id, slug, role')
    .in('id', ids);

  const order = new Map(ids.map((id, i) => [id, i]));
  const list = (profiles ?? []).slice().sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );

  return NextResponse.json({ list });
}
