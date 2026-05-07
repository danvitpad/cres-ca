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
  /** TG username без @ (для ссылки). */
  tgUsername: string | null;
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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
      // 5 сек таймаут — Apps Script бывает медленный, но если совсем висит,
      // не блокируем основной запрос.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[feedback-sheet] non-2xx:', res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[feedback-sheet] sync failed:', (e as Error).message);
    return false;
  }
}
