/** --- YAML
 * name: Follow Toggle API
 * description: POST {targetId} → toggles follow. Returns {following: boolean, followers_count}.
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { targetId?: string };
  const targetId = body.targetId?.trim();
  if (!targetId) return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  if (targetId === user.id) return NextResponse.json({ error: 'cannot_follow_self' }, { status: 400 });

  const { data: existing } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle();

  if (existing) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
  } else {
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('followers_count')
    .eq('id', targetId)
    .maybeSingle();

  return NextResponse.json({ following: !existing, followersCount: target?.followers_count ?? 0 });
}
