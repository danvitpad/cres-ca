/** --- YAML
 * name: Feedback → Google Sheets sync
 * description: POST'ит фидбек в Google Apps Script Web App, который пишет
 *              новую строку в Sheet «Фитбек». URL Web App в env
 *              FEEDBACK_SHEET_WEBHOOK_URL. Если переменной нет — sync
 *              просто пропускается (best-effort, не валит submitFeedback).
 *              Apps Script код смотри в docs/feedback-sheets.md.
 * created: 2026-05-07
 * --- */

export interface FeedbackSheetRow {
  /** ISO timestamp когда фидбек получен. */
  createdAt: string;
  /** Имя пользователя для отображения. */
  profileName: string;
  /** «master» / «client» / «salon_admin» / null. */
  profileRole: string | null;
  /** TG username без @ (для ссылки). null если у пользователя закрыт username. */
  tgUsername: string | null;
  /** TG chat_id (числовой) — нужен для связи через `tg://user?id=...` если
   *  у пользователя нет username, и для прямой отправки сообщения через бот. */
  tgChatId: number | null;
  /** Категория с эмодзи: «🐛 Баг» / «💡 Пожелание» / ... */
  categoryLabel: string;
  /** Транскрипт после AI cleanup. */
  cleanedText: string;
  /** Сырой текст до cleanup (что на самом деле сказал пользователь). */
  originalText: string;
  /** ID записи в таблице feedback (для cross-reference). */
  feedbackId: string;
  /** Источник: web_settings / telegram_voice / telegram_bot / mobile. */
  source: string;
}

/**
 * Шлёт строку в Google Apps Script Web App. Best-effort: ошибки логируются,
 * но не пробрасываются — фидбек уже в БД и в TG, Sheets — приятный бонус.
 */
export async function appendFeedbackToSheet(row: FeedbackSheetRow): Promise<boolean> {
  const url = process.env.FEEDBACK_SHEET_WEBHOOK_URL;
  if (!url) return false;

  // ПРОБЛЕМА UTF-8 в Apps Script:
  // При POST с json/text-body Apps Script кладёт `e.postData.contents` как
  // строку, **уже декодированную как Latin-1**. Кириллица/эмодзи приходят
  // в виде «?????» в таблице независимо от Content-Type.
  //
  // РЕШЕНИЕ: отправляем JSON в base64 как form-параметр `payload`. Тогда
  // Apps Script кладёт base64 в `e.parameter.payload`, и мы вручную
  // декодируем UTF-8 на стороне Apps Script (Utilities.newBlob + UTF-8).
  // Этот путь устойчив к кодировкам и не теряет body на 302 redirect
  // (form-encoded запросы fetch обрабатывает корректно).
  const json = JSON.stringify(row);
  const payloadB64 = Buffer.from(json, 'utf-8').toString('base64');
  const formBody = `payload=${encodeURIComponent(payloadB64)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn('[feedback-sheet] non-2xx:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[feedback-sheet] sync failed:', (e as Error).message);
    return false;
  }
}
