/** --- YAML
 * name: Profile Edit API
 * description: PATCH {fullName?, bio?, slug?, avatarUrl?} — обновляет профиль текущего пользователя.
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SLUG_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    bio?: string;
    slug?: string;
    avatarUrl?: string;
  };

  const update: Record<string, unknown> = {};
  if (typeof body.fullName === 'string' && body.fullName.trim()) update.full_name = body.fullName.trim();
  if (typeof body.bio === 'string') update.bio = body.bio.slice(0, 280);
  if (typeof body.avatarUrl === 'string') update.avatar_url = body.avatarUrl;

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (slug === '') {
      update.slug = null;
    } else {
      if (!SLUG_RE.test(slug)) {
        return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
      }
      const { data: clash } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .neq('id', user.id)
        .maybeSingle();
      if (clash) return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
      update.slug = slug;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: Object.keys(update) });
}
