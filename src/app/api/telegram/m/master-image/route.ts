/** --- YAML
 * name: Telegram Master Image API
 * description: Upload и удаление обложки/аватара мастера для inline-редактора
 *              публичной страницы в Mini App. POST FormData {target,file} —
 *              грузит в Supabase Storage bucket `avatars` под путём
 *              {userId}/{target}-{ts}.{ext}, пишет в masters.avatar_url или
 *              masters.cover_url. POST JSON {action:'delete-cover'} — обнуляет
 *              cover_url. Service-role + initData валидация.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/webp', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/heif',
]);

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = admin();
  const { data: master } = await db
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!master) {
    return NextResponse.json({ error: 'not_master' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') || '';

  // JSON path: action='delete-cover'
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as { action?: string };
    if (body.action === 'delete-cover') {
      const { error } = await db.from('masters').update({ cover_url: null }).eq('id', master.id);
      if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  // FormData path: upload
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const target = (form.get('target') as string) || '';
  if (target !== 'avatar' && target !== 'cover') {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  const ct = file.type || 'image/webp';
  if (!ALLOWED_TYPES.has(ct)) {
    return NextResponse.json({ error: 'invalid_type', detail: ct }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: 'empty_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 400 });

  const ext =
    ct === 'image/png' ? 'png' :
    ct === 'image/jpeg' || ct === 'image/jpg' ? 'jpg' :
    ct === 'image/gif' ? 'gif' :
    ct === 'image/heic' || ct === 'image/heif' ? 'heic' :
    'webp';

  const path = `${userId}/${target}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from('avatars')
    .upload(path, buffer, { contentType: ct, cacheControl: '3600', upsert: true });
  if (upErr) {
    return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 500 });
  }

  const { data: pub } = db.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl;

  const update = target === 'avatar' ? { avatar_url: url } : { cover_url: url };
  const { error: updErr } = await db.from('masters').update(update).eq('id', master.id);
  if (updErr) {
    return NextResponse.json({ error: 'update_failed', detail: updErr.message }, { status: 500 });
  }

  // Если меняли аватар — синхронизируем и profiles.avatar_url, чтобы fallback
  // в других местах (где нет master row) тоже подхватил новое фото.
  if (target === 'avatar') {
    await db.from('profiles').update({ avatar_url: url }).eq('id', userId).then(() => null);
  }

  return NextResponse.json({ ok: true, url });
}
