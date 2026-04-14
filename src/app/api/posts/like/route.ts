/** --- YAML
 * name: Post Like Toggle API
 * description: POST {postId} → toggles post_likes row for current viewer. Returns {liked, likesCount}.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { postId } = (await req.json().catch(() => ({}))) as { postId?: string };
  if (!postId) return NextResponse.json({ error: 'missing_post_id' }, { status: 400 });

  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('profile_id', user.id);
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, profile_id: user.id });
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  const { data: post } = await supabase
    .from('posts')
    .select('likes_count')
    .eq('id', postId)
    .maybeSingle();

  return NextResponse.json({ liked: !existing, likesCount: post?.likes_count ?? 0 });
}
