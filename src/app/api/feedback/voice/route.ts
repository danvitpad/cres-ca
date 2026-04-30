/** --- YAML
 * name: Voice feedback API
 * description: POST /api/feedback/voice — аудио (multipart/form-data field "audio").
 *              Транскрибация Gemini → submitFeedback() (cleanup, categorize, DB,
 *              text-уведомление в TG, Sheets-sync) → отдельно шлёт оригинальный
 *              аудио-файл напрямую Данилу через @crescasuperadmin_bot, чтобы он
 *              мог прослушать в TG не открывая ссылок. Пользователь о факте
 *              пересылки не знает — просто видит «спасибо за фидбек».
 * created: 2026-04-21
 * updated: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { voiceToText, AIUnavailableError } from '@/lib/ai/router';
import { submitFeedback, type FeedbackSource } from '@/lib/feedback/submit';
import { sendVoiceToSuperadmin } from '@/lib/notifications/superadmin-notify';

export const maxDuration = 60;

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

  // 1) Транскрибация
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

  // 2) Профиль для snapshot
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();
  const profileName = profile?.full_name ?? user.email ?? 'User';
  const profileRole = profile?.role ?? null;

  // 3) Сохраняем фидбек (текст-уведомление Данилу + Sheets sync)
  const result = await submitFeedback({
    supabase,
    profileId: user.id,
    profileName,
    profileRole,
    source,
    originalText: transcript,
    voiceFileUrl: null, // больше не сохраняем в Storage — голос идёт напрямую в TG
  });

  if (!result) {
    return NextResponse.json({ error: 'submit_failed' }, { status: 500 });
  }

  // 4) Отправляем оригинальный аудио-файл напрямую Данилу в супер-бот.
  // Делается ПОСЛЕ submitFeedback, чтобы Daniil сначала видел текстовое
  // сообщение с категорией и сутью, потом получил голос для прослушивания.
  // Пользователь об этой пересылке не знает — UI не показывает.
  // Best-effort: если упадёт — фидбек всё равно сохранён.
  await sendVoiceToSuperadmin(buf, mimeType, `Фидбек <code>${result.id}</code> · от ${profileName}`);

  return NextResponse.json({ id: result.id, transcript, category: result.category });
}
