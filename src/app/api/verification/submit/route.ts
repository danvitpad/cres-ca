/** --- YAML
 * name: Verification submit API
 * description: User uploads a photo (selfie+doc or cert). Server stores in Supabase Storage and creates a pending verification_request for superadmin review.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected_multipart' }, { status: 400 });
  }

  const kind = form.get('kind') as 'identity' | 'expertise' | null;
  const document = form.get('document');
  const selfie = form.get('selfie');
  const note = (form.get('note') as string | null) ?? null;

  if (!kind || (kind !== 'identity' && kind !== 'expertise')) {
    return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
  }
  if (!(document instanceof Blob) || document.size === 0) {
    return NextResponse.json({ error: 'no_document' }, { status: 400 });
  }
  if (document.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'document_too_large' }, { status: 413 });
  }
  if (kind === 'identity' && !(selfie instanceof Blob && selfie.size > 0)) {
    return NextResponse.json({ error: 'selfie_required_for_identity' }, { status: 400 });
  }

  const ts = Date.now();
  const docKey = `${user.id}/${kind}_doc_${ts}.jpg`;
  const selfieKey = selfie instanceof Blob ? `${user.id}/${kind}_selfie_${ts}.jpg` : null;

  const docUpload = await supabase.storage
    .from('verification')
    .upload(docKey, document, { contentType: document.type || 'image/jpeg', upsert: false });
  if (docUpload.error) {
    return NextResponse.json({ error: 'document_upload_failed', details: docUpload.error.message }, { status: 500 });
  }

  let selfieUrl: string | null = null;
  if (selfie instanceof Blob && selfieKey) {
    const selfieUpload = await supabase.storage
      .from('verification')
      .upload(selfieKey, selfie, { contentType: selfie.type || 'image/jpeg', upsert: false });
    if (selfieUpload.error) {
      return NextResponse.json({ error: 'selfie_upload_failed', details: selfieUpload.error.message }, { status: 500 });
    }
    selfieUrl = selfieKey;
  }

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  const { data: row, error } = await supabase
    .from('verification_requests')
    .insert({
      profile_id: user.id,
      master_id: master?.id ?? null,
      kind,
      status: 'pending',
      selfie_url: selfieUrl,
      document_url: docKey,
      note,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: row?.id });
}
