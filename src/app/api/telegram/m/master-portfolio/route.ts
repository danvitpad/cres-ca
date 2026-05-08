/** --- YAML
 * name: Telegram Master Portfolio API
 * description: CRUD портфолио мастера для inline-редактора публичной страницы.
 *              POST FormData {file, caption?} — загружает фото в Storage и
 *              создаёт row в master_portfolio.
 *              POST JSON {action:'update', id, caption} — меняет подпись.
 *              POST JSON {action:'delete', id} — мягко удаляет (is_published=false).
 *              Service-role + initData валидация.
 * created: 2026-05-08
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
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = admin();
  const { data: master } = await db
    .from('masters').select('id').eq('profile_id', userId).maybeSingle<{ id: string }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const contentType = req.headers.get('content-type') || '';

  // JSON path — update / delete
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as {
      action?: 'update' | 'delete';
      id?: string;
      caption?: string | null;
    };
    if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    // ownership
    const { data: existing } = await db
      .from('master_portfolio')
      .select('master_id')
      .eq('id', body.id)
      .maybeSingle<{ master_id: string }>();
    if (!existing || existing.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    if (body.action === 'update') {
      const { error } = await db
        .from('master_portfolio')
        .update({ caption: (body.caption ?? '').toString().trim() || null })
        .eq('id', body.id);
      if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'delete') {
      const { error } = await db
        .from('master_portfolio')
        .update({ is_published: false })
        .eq('id', body.id);
      if (error) return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  // FormData path — upload
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'invalid_form' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  const ct = file.type || 'image/webp';
  if (!ALLOWED_TYPES.has(ct)) return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'empty_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 400 });

  const ext =
    ct === 'image/png' ? 'png' :
    ct === 'image/jpeg' || ct === 'image/jpg' ? 'jpg' :
    ct === 'image/gif' ? 'gif' :
    ct === 'image/heic' || ct === 'image/heif' ? 'heic' :
    'webp';
  const path = `${userId}/portfolio-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from('avatars')
    .upload(path, buffer, { contentType: ct, cacheControl: '3600', upsert: true });
  if (upErr) return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 500 });

  const { data: pub } = db.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl;
  const caption = (form.get('caption') as string | null)?.trim() || null;

  const { data, error } = await db
    .from('master_portfolio')
    .insert({
      master_id: master.id,
      image_url: url,
      caption,
      is_published: true,
    })
    .select('id, image_url, caption')
    .single();
  if (error || !data) return NextResponse.json({ error: 'insert_failed', detail: error?.message }, { status: 500 });

  return NextResponse.json({ ok: true, item: data });
}
