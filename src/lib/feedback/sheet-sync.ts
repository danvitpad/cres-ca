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

  const body = JSON.stringify(row);
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };
  // 10 сек таймаут — Apps Script на холодном старте бывает 5-7 сек.
  // Один и тот же сигнал используем для обоих запросов.
  const signal = AbortSignal.timeout(10000);

  try {
    // Apps Script Web App делает 302 redirect:
    //   script.google.com/macros/s/{ID}/exec
    //     ↓
    //   script.googleusercontent.com/macros/echo?user_content_key=…
    // По fetch spec при 302 на POST body НЕ пересылается на новый URL
    // (или конвертится в GET) — googleusercontent отвечает 411 Length
    // Required. Делаем redirect вручную: первый POST с redirect:'manual',
    // читаем Location, делаем второй POST на final URL с тем же body —
    // fetch автоматически поставит Content-Length и всё проходит.
    //
    // Важно про Content-Type — text/plain;charset=utf-8 нужен чтобы
    // Apps Script читал body как UTF-8 (кириллица/эмодзи). При
    // application/json он получает байты в неизвестной кодировке и
    // выдаёт «?????» в таблице. Этот же Content-Type не триггерит
    // CORS preflight, лишний для server-side fetch но не помешает.
    const initial = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal,
    });

    let finalRes: Response;
    if (initial.status === 302 || initial.status === 303 || initial.status === 307 || initial.status === 308) {
      const location = initial.headers.get('location');
      if (!location) {
        console.warn('[feedback-sheet] redirect without Location header');
        return false;
      }
      finalRes = await fetch(location, {
        method: 'POST',
        headers,
        body,
        signal,
      });
    } else {
      finalRes = initial;
    }

    if (!finalRes.ok) {
      console.warn('[feedback-sheet] non-2xx after redirect:', finalRes.status, await finalRes.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[feedback-sheet] sync failed:', (e as Error).message);
    return false;
  }
}
