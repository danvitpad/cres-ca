/** --- YAML
 * name: submitFeedback core
 * description: Единая точка входа для сохранения фидбека (текст или голос).
 *              Принимает уже расшифрованный текст + опциональный URL аудио.
 *              Делает: AI cleanup+categorize → DB insert → TG-notify → Sheets sync.
 *              Используется и в /api/feedback (текст), и в /api/feedback/voice (голос),
 *              и в Telegram webhook (mastersave + voice).
 * created: 2026-04-30
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import { notifySuperadmin } from '@/lib/notifications/superadmin-notify';
import { appendFeedbackRow } from '@/lib/integrations/google-sheets';

export type FeedbackSource = 'web_settings' | 'telegram_bot' | 'telegram_voice' | 'mobile';
export type FeedbackCategory = 'bug' | 'feature' | 'question' | 'praise' | 'other';

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: '🐛 Баг',
  feature: '💡 Пожелание',
  question: '❓ Вопрос',
  praise: '👏 Благодарность',
  other: '📝 Другое',
};

interface AnalysisResult {
  cleaned: string;
  category: FeedbackCategory;
}

export async function analyzeFeedback(original: string): Promise<AnalysisResult> {
  const fallback: AnalysisResult = { cleaned: original.trim(), category: 'other' };
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || original.length < 12) return fallback;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'Обработай обратную связь от пользователя CRES-CA. Верни строго JSON без markdown:\n' +
              '1) cleaned — суть без воды/повторов, на языке оригинала.\n' +
              '2) category — одно из: "bug" (не работает / ошибка), "feature" (хочу / добавьте / было бы), "question" (как сделать / не понимаю), "praise" (спасибо / нравится), "other".\n' +
              'Формат: {"cleaned":"...","category":"bug"}',
          },
          { role: 'user', content: original },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return fallback;
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = j.choices?.[0]?.message?.content?.trim();
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<AnalysisResult>;
    const cleaned = (parsed.cleaned ?? '').toString().trim() || original.trim();
    const cats: FeedbackCategory[] = ['bug', 'feature', 'question', 'praise', 'other'];
    const category: FeedbackCategory = cats.includes(parsed.category as FeedbackCategory)
      ? (parsed.category as FeedbackCategory)
      : 'other';
    return { cleaned, category };
  } catch {
    return fallback;
  }
}

interface SubmitOpts {
  supabase: SupabaseClient;
  profileId: string;
  profileName: string;
  profileRole: string | null;
  source: FeedbackSource;
  originalText: string;
  voiceFileUrl: string | null;
}

interface SubmitResult {
  id: string;
  cleaned: string;
  category: FeedbackCategory;
  sheetSynced: boolean;
}

async function sendTg(chatId: string, text: string, buttons?: Array<{ text: string; url: string }>): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (buttons && buttons.length > 0) body.reply_markup = { inline_keyboard: [buttons] };
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
    return j.ok ? (j.result?.message_id ?? null) : null;
  } catch {
    return null;
  }
}

/** Главный entry: сохраняет фидбек со всеми эффектами. */
export async function submitFeedback(opts: SubmitOpts): Promise<SubmitResult | null> {
  const { supabase, profileId, profileName, profileRole, source, originalText, voiceFileUrl } = opts;

  const { cleaned, category } = await analyzeFeedback(originalText);

  const { data: row, error } = await supabase
    .from('feedback')
    .insert({
      profile_id: profileId,
      source,
      original_text: originalText,
      cleaned_text: cleaned,
      category,
      voice_file_url: voiceFileUrl,
      profile_name: profileName,
      profile_role: profileRole,
    })
    .select('id, created_at')
    .single();

  if (error || !row) {
    console.error('[feedback] insert failed:', error);
    return null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cres-ca.com';
  const adminUrl = `${appUrl}/ru/superadmin/feedback`;
  const sheetsId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetsUrl = sheetsId ? `https://docs.google.com/spreadsheets/d/${sheetsId}` : null;

  const voiceLine = voiceFileUrl ? `\n<b>🎙 Аудио:</b> ${voiceFileUrl}` : '';
  const roleLine = profileRole ? ` (${profileRole})` : '';
  const tgText =
    `${CATEGORY_LABELS[category]} <b>Новый фидбек</b>\n` +
    `<b>От:</b> ${profileName}${roleLine}\n` +
    `<b>Источник:</b> ${source}\n` +
    `<b>ID:</b> <code>${row.id}</code>${voiceLine}\n\n` +
    `<b>Суть:</b>\n${cleaned}\n\n` +
    `<i>Оригинал:</i>\n${originalText}`;

  const buttons: Array<{ text: string; url: string }> = [{ text: '🔧 Открыть в админке', url: adminUrl }];
  if (sheetsUrl) buttons.push({ text: '📊 Таблица', url: sheetsUrl });

  await notifySuperadmin(tgText, { parseMode: 'HTML', buttons: [buttons] });

  const channelId = process.env.FEEDBACK_TG_CHANNEL_ID;
  if (channelId) {
    const tgMessageId = await sendTg(channelId, tgText, buttons);
    if (tgMessageId) {
      await supabase.from('feedback').update({ tg_message_id: tgMessageId }).eq('id', row.id);
    }
  }

  const sheetOk = await appendFeedbackRow([
    new Date(row.created_at).toISOString(),
    profileName,
    profileRole ?? '',
    profileId,
    source,
    CATEGORY_LABELS[category],
    cleaned,
    originalText,
    voiceFileUrl ?? '',
  ]);
  if (sheetOk) {
    await supabase.from('feedback').update({ sheet_synced_at: new Date().toISOString() }).eq('id', row.id);
  }

  return { id: row.id, cleaned, category, sheetSynced: sheetOk };
}
