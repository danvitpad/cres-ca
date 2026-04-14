/** --- YAML
 * name: Posts API
 * description: POST {imageUrl, caption} → creates a post for the current user. DELETE ?id=... removes own post.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { imageUrl, caption } = (await req.json().catch(() => ({}))) as {
    imageUrl?: string;
    caption?: string;
  };

  if (!imageUrl) return NextResponse.json({ error: 'missing_image' }, { status: 400 });

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      image_url: imageUrl,
      caption: caption?.slice(0, 2000) ?? null,
    })
    .select('id, image_url, caption, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ post: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const { error } = await supabase.from('posts').delete().eq('id', id).eq('author_id', user.id);
  if (error) return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
