/** --- YAML
 * name: Feedback submit API
 * description: POST /api/feedback — принимает текст фидбека, сохраняет в public.feedback,
 *              очищает via OpenRouter (убирает мусорные слова, оставляет суть),
 *              отправляет в TG-канал FEEDBACK_TG_CHANNEL_ID.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PostBody {
  text: string;
  source?: 'web_settings' | 'telegram_bot' | 'telegram_voice' | 'mobile';
  voice_file_url?: string | null;
}

async function cleanText(original: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || original.length < 12) return original.trim();

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'Ты очищаешь пользовательский feedback. Убери слова-паразиты и повторы, оставь только суть. Сохраняй язык оригинала, не добавляй комментариев, выдай только очищенный текст.',
          },
          { role: 'user', content: original },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return original.trim();
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return j.choices?.[0]?.message?.content?.trim() || original.trim();
  } catch {
    return original.trim();
  }
}

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
    if (!j.ok) return null;
    return j.result?.message_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Broadcast feedback to Telegram. Sends in parallel to both targets when configured:
 *   - FEEDBACK_TG_CHANNEL_ID — team channel (if any)
 *   - SUPERADMIN_TG_CHAT_ID  — personal DM to the founder
 * Either may be omitted. Returns the channel message id (for superadmin table cross-link).
 */
async function sendToTgChannel(payload: {
  profileName: string;
  profileRole: string | null;
  source: string;
  original: string;
  cleaned: string;
  feedbackId: string;
  voiceFileUrl: string | null;
}): Promise<number | null> {
  const channelId = process.env.FEEDBACK_TG_CHANNEL_ID;
  const adminId = process.env.SUPERADMIN_TG_CHAT_ID;
  if (!channelId && !adminId) return null;

  const voiceLine = payload.voiceFileUrl ? `\n<b>🎙 Аудио:</b> ${payload.voiceFileUrl}` : '';
  const roleLine = payload.profileRole ? ` (${payload.profileRole})` : '';
  const text =
    `💬 <b>Новый feedback</b>\n` +
    `<b>От:</b> ${payload.profileName}${roleLine}\n` +
    `<b>Источник:</b> ${payload.source}\n` +
    `<b>ID:</b> <code>${payload.feedbackId}</code>${voiceLine}\n\n` +
    `<b>Суть:</b>\n${payload.cleaned}\n\n` +
    `<i>Оригинал:</i>\n${payload.original}`;

  const [channelMsgId] = await Promise.all([
    channelId ? sendTg(channelId, text) : Promise.resolve(null),
    adminId && adminId !== channelId ? sendTg(adminId, text) : Promise.resolve(null),
  ]);
  return channelMsgId;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as PostBody;
  const original = (body.text ?? '').trim();
  if (original.length < 4) return NextResponse.json({ error: 'too short' }, { status: 400 });

  const cleaned = await cleanText(original);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();
  const profileName = profile?.full_name ?? user.email ?? 'User';
  const profileRole = profile?.role ?? null;

  const { data: row, error } = await supabase
    .from('feedback')
    .insert({
      profile_id: user.id,
      source: body.source ?? 'web_settings',
      original_text: original,
      cleaned_text: cleaned,
      voice_file_url: body.voice_file_url ?? null,
    })
    .select('id')
    .single();

  if (error || !row) return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });

  const tgMessageId = await sendToTgChannel({
    profileName,
    profileRole,
    source: body.source ?? 'web_settings',
    original,
    cleaned,
    feedbackId: row.id,
    voiceFileUrl: body.voice_file_url ?? null,
  });

  if (tgMessageId) {
    await supabase.from('feedback').update({ tg_message_id: tgMessageId }).eq('id', row.id);
  }

  return NextResponse.json({ id: row.id, cleaned });
}
