/** --- YAML
 * name: Voice feedback API
 * description: Accepts audio blob (multipart/form-data with field "audio"), transcribes via voiceToText (Gemini chain with fallback), cleans via /api/feedback pipeline, saves to public.feedback and notifies superadmin TG. Works for client / master / team — source determined by client-supplied field.
 * created: 2026-04-21
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { voiceToText, AIUnavailableError } from '@/lib/ai/router';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function sendTg(chatId: string, text: string): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const j = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
    return j.ok ? (j.result?.message_id ?? null) : null;
  } catch {
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
  const source = (form.get('source') as string | null) ?? 'mobile';

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'no audio' }, { status: 400 });
  }
  if (audio.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'audio too large (max 10MB)' }, { status: 413 });
  }

  const mimeType = audio.type || 'audio/webm';
  const buf = Buffer.from(await audio.arrayBuffer());
  const audioBase64 = buf.toString('base64');

  // Transcribe via AI router (Gemini chain with auto-fallback)
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

  // Profile (for TG message)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();
  const profileName = profile?.full_name ?? user.email ?? 'User';
  const profileRole = profile?.role ?? null;

  // Save feedback row (cleaned_text equals transcript since voiceToText already normalises)
  const { data: row, error } = await supabase
    .from('feedback')
    .insert({
      profile_id: user.id,
      source: source === 'web_settings' ? 'web_settings' : 'mobile',
      original_text: transcript,
      cleaned_text: transcript,
      voice_file_url: null,
    })
    .select('id')
    .single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
  }

  // Notify TG (founder DM + team channel if set)
  const channelId = process.env.FEEDBACK_TG_CHANNEL_ID;
  const adminId = process.env.SUPERADMIN_TG_CHAT_ID;
  if (channelId || adminId) {
    const roleLine = profileRole ? ` (${profileRole})` : '';
    const text =
      `🎙 <b>Голосовой feedback</b>\n` +
      `<b>От:</b> ${profileName}${roleLine}\n` +
      `<b>Источник:</b> ${source}\n` +
      `<b>ID:</b> <code>${row.id}</code>\n\n` +
      `<b>Расшифровка:</b>\n${transcript}`;
    const [channelMsgId] = await Promise.all([
      channelId ? sendTg(channelId, text) : Promise.resolve(null),
      adminId && adminId !== channelId ? sendTg(adminId, text) : Promise.resolve(null),
    ]);
    if (channelMsgId) {
      await supabase.from('feedback').update({ tg_message_id: channelMsgId }).eq('id', row.id);
    }
  }

  return NextResponse.json({ id: row.id, transcript });
}
