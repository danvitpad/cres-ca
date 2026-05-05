/** --- YAML
 * name: Profile Avatar Upload API
 * description: POST multipart/form-data { file } — загружает аватар клиента в
 *              Supabase Storage bucket `avatars` под путём `{userId}/{ts}.webp`
 *              и пишет в profiles.avatar_url. Использует service-role, поэтому
 *              работает и для Mini App юзеров (Telegram initData), у которых
 *              нет Supabase cookie-сессии — для них RLS-политика на storage
 *              блокирует прямую браузерную загрузку.
 * created: 2026-05-05
 * updated: 2026-05-05
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }

  const contentType = (file as Blob).type || 'image/webp';
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'invalid_type', detail: contentType }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }

  const ext =
    contentType === 'image/png' ? 'png' :
    contentType === 'image/jpeg' || contentType === 'image/jpg' ? 'jpg' :
    contentType === 'image/gif' ? 'gif' :
    contentType === 'image/heic' || contentType === 'image/heif' ? 'heic' :
    'webp';

  const path = `${userId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const db = admin();

  const { error: upErr } = await db.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json(
      { error: 'upload_failed', detail: upErr.message },
      { status: 500 },
    );
  }

  const { data: pub } = db.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = pub.publicUrl;

  const { error: updErr } = await db
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (updErr) {
    return NextResponse.json(
      { error: 'profile_update_failed', detail: updErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
