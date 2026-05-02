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
  /** Telegram chat_id для прямых ответов через бот. Опционально. */
  tgChatId?: number | null;
}

interface SubmitResult {
  id: string;
  cleaned: string;
  category: FeedbackCategory;
  sheetSynced: boolean;
}

/** Главный entry: сохраняет фидбек со всеми эффектами. */
export async function submitFeedback(opts: SubmitOpts): Promise<SubmitResult | null> {
  const { supabase, profileId, profileName, profileRole, source, originalText, voiceFileUrl, tgChatId } = opts;

  const { cleaned, category } = await analyzeFeedback(originalText);

  // Подтягиваем telegram_username + telegram_id для красивой ссылки + reply-flow
  const { data: prof } = await supabase
    .from('profiles')
    .select('telegram_username, telegram_id')
    .eq('id', profileId)
    .maybeSingle<{ telegram_username: string | null; telegram_id: number | null }>();
  const tgUser = prof?.telegram_username ?? null;
  const resolvedChatId = tgChatId ?? prof?.telegram_id ?? null;

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
      tg_chat_id: resolvedChatId,
    })
    .select('id, created_at')
    .single();

  if (error || !row) {
    console.error('[feedback] insert failed:', error);
    return null;
  }

  const tgText = formatFeedbackNotification({
    category,
    profileName,
    profileRole,
    cleaned,
    originalText,
    tgUsername: tgUser,
  });

  await notifySuperadmin(tgText, {
    parseMode: 'HTML',
    buttons: buildFeedbackButtons({ feedbackId: row.id, tgUsername: tgUser, hasChatId: !!resolvedChatId }),
  });

  const sheetOk = await appendFeedbackRow([
    new Date(row.created_at).toISOString(),
    profileName,
    profileRole ?? '',
    tgUser ? `@${tgUser}` : '',
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

/** Унифицированный формат уведомления Данилу — без шумовых полей (id, source). */
export function formatFeedbackNotification(input: {
  category: FeedbackCategory;
  profileName: string;
  profileRole: string | null;
  cleaned: string;
  originalText: string;
  tgUsername: string | null;
}): string {
  const { category, profileName, profileRole, cleaned, originalText, tgUsername } = input;
  const roleLine = profileRole ? ` · ${profileRole}` : '';
  const tgLine = tgUsername ? `\n<b>TG:</b> <a href="https://t.me/${tgUsername}">@${tgUsername}</a>` : '';
  const sameAsCleaned = cleaned.trim() === originalText.trim();
  const main = sameAsCleaned
    ? `\n${cleaned}`
    : `\n<b>Суть:</b> ${cleaned}\n\n<i>Оригинал:</i>\n${originalText}`;
  return (
    `${CATEGORY_LABELS[category]} <b>Новый отзыв</b>\n` +
    `<b>От:</b> ${profileName}${roleLine}` +
    tgLine +
    main
  );
}

/** Кнопки под уведомлением: ответить через бота + открыть TG напрямую. */
export function buildFeedbackButtons(input: {
  feedbackId: string;
  tgUsername: string | null;
  hasChatId: boolean;
}): Array<Array<{ text: string; url?: string; callback_data?: string }>> {
  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
  const firstRow: Array<{ text: string; url?: string; callback_data?: string }> = [];
  if (input.hasChatId) {
    firstRow.push({ text: '💬 Ответить', callback_data: `fb_reply:${input.feedbackId}` });
  }
  if (input.tgUsername) {
    firstRow.push({ text: '👤 Открыть TG', url: `https://t.me/${input.tgUsername}` });
  }
  if (firstRow.length > 0) rows.push(firstRow);
  rows.push([{ text: '✅ Готово', callback_data: `fb_done:${input.feedbackId}` }]);
  return rows;
}
