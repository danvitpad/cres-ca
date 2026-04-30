/** --- YAML
 * name: Voice feedback API
 * description: POST /api/feedback/voice — аудио (multipart/form-data field "audio")
 *              → транскрибация Gemini → upload в Storage bucket feedback-voice
 *              → submitFeedback() с voice_file_url. Все эффекты (DB / TG / Sheets)
 *              делает submitFeedback.
 * created: 2026-04-21
 * updated: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { voiceToText, AIUnavailableError } from '@/lib/ai/router';
import { submitFeedback, type FeedbackSource } from '@/lib/feedback/submit';

export const maxDuration = 60;

const STORAGE_BUCKET = 'feedback-voice';

async function uploadAudio(buf: Buffer, mimeType: string, profileId: string): Promise<string | null> {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) return null;

  try {
    const admin = createAdminClient(adminUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('webm') ? 'webm' : 'm4a';
    const path = `${profileId}/${Date.now()}.${ext}`;

    const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, buf, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      console.warn('[feedback/voice] storage upload failed:', error.message);
      return null;
    }

    // Bucket публичный → возвращаем public URL. Если приватный — getPublicUrl всё равно
    // возвращает строку, но при доступе будет 403. Можно при необходимости делать
    // signed URL, но для админа Daniil это не критично.
    const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return pub.publicUrl;
  } catch (e) {
    console.warn('[feedback/voice] upload error:', e);
    return null;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const audio = form.get('audio');
  const source = ((form.get('source') as string | null) ?? 'mobile') as FeedbackSource;

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'no audio' }, { status: 400 });
  }
  if (audio.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'audio too large (max 10MB)' }, { status: 413 });
  }

  const mimeType = audio.type || 'audio/webm';
  const buf = Buffer.from(await audio.arrayBuffer());
  const audioBase64 = buf.toString('base64');

  // Транскрибация
  let transcript = '';
  try {
    const res = await voiceToText({ audioBase64, mimeType });
    transcript = (res.data ?? '').trim();
  } catch (e) {
    console.error('[feedback/voice] transcription failed:', e instanceof AIUnavailableError ? e.message : e);
    return NextResponse.json({ error: 'transcription_unavailable' }, { status: 503 });
  }
  if (transcript.length < 3) {
    return NextResponse.json({ error: 'transcript_empty' }, { status: 400 });
  }

  // Upload в Storage (best-effort)
  const voiceFileUrl = await uploadAudio(buf, mimeType, user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const result = await submitFeedback({
    supabase,
    profileId: user.id,
    profileName: profile?.full_name ?? user.email ?? 'User',
    profileRole: profile?.role ?? null,
    source,
    originalText: transcript,
    voiceFileUrl,
  });

  if (!result) {
    return NextResponse.json({ error: 'submit_failed' }, { status: 500 });
  }

  return NextResponse.json({ id: result.id, transcript, category: result.category, voice_file_url: voiceFileUrl });
}
