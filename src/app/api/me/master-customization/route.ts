/** --- YAML
 * name: Master Public-Page Customization
 * description: PATCH endpoint for the owning master to update appearance fields of
 *              their /m/{slug} public page (theme colors, banner position, contact
 *              visibility toggles, interests, social links, page type). Cover image
 *              and avatar uploads still go through Supabase storage directly from
 *              the client — only the resulting URLs are persisted here.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PAGE_TYPES = new Set(['master', 'salon', 'clinic', 'workshop', 'auto_service', 'fitness', 'other']);

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Whitelist + per-field validation. Anything not in the whitelist is silently dropped.
  const update: Record<string, unknown> = {};

  if ('cover_url' in body) {
    update.cover_url = typeof body.cover_url === 'string' || body.cover_url === null
      ? body.cover_url : undefined;
  }
  if ('avatar_url' in body) {
    // avatar lives on profiles, handled separately below
  }
  if ('bio' in body && (typeof body.bio === 'string' || body.bio === null)) {
    update.bio = body.bio;
  }
  if ('theme_primary_color' in body) {
    if (body.theme_primary_color === null) update.theme_primary_color = null;
    else if (isHexColor(body.theme_primary_color)) update.theme_primary_color = body.theme_primary_color;
  }
  if ('theme_background_color' in body) {
    if (body.theme_background_color === null) update.theme_background_color = null;
    else if (isHexColor(body.theme_background_color)) update.theme_background_color = body.theme_background_color;
  }
  if ('banner_position_y' in body) {
    const n = Number(body.banner_position_y);
    if (Number.isFinite(n) && n >= 0 && n <= 100) update.banner_position_y = Math.round(n);
  }
  if ('phone_public' in body) update.phone_public = Boolean(body.phone_public);
  if ('email_public' in body) update.email_public = Boolean(body.email_public);
  if ('dob_public' in body)   update.dob_public   = Boolean(body.dob_public);
  if ('interests' in body && Array.isArray(body.interests)) {
    update.interests = body.interests
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  if ('social_links' in body && body.social_links && typeof body.social_links === 'object' && !Array.isArray(body.social_links)) {
    const ALLOWED = new Set(['telegram', 'instagram', 'whatsapp', 'viber', 'tiktok', 'youtube', 'website']);
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.social_links as Record<string, unknown>)) {
      if (!ALLOWED.has(k)) continue;
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      if (trimmed) cleaned[k] = trimmed.slice(0, 200);
    }
    update.social_links = cleaned;
  }
  if ('page_type' in body && typeof body.page_type === 'string' && PAGE_TYPES.has(body.page_type)) {
    update.page_type = body.page_type;
  }
  if ('is_public' in body) update.is_public = Boolean(body.is_public);

  if (Object.keys(update).length === 0 && !('avatar_url' in body)) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Avatar lives on profiles, not masters, so it gets its own update.
  if ('avatar_url' in body && (typeof body.avatar_url === 'string' || body.avatar_url === null)) {
    await supabase.from('profiles').update({ avatar_url: body.avatar_url as string | null }).eq('id', user.id);
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('masters').update(update).eq('profile_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(update).length });
}
