/** --- YAML
 * name: Superadmin notify helper
 * description: Шлёт сообщение Данилу в @crescasuperadmin_bot. Используется для всех
 *   системных уведомлений: заявки на бету, фидбек, жалобы, критические ошибки.
 *   Best-effort — не валит основной flow если токен не задан или TG недоступен.
 * created: 2026-04-29
 * --- */

interface InlineButton {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
}

interface SendOpts {
  /** HTML-разметка по умолчанию (поддерживает <b>, <i>, <a>, <code>). */
  parseMode?: 'HTML' | 'Markdown';
  /** Inline кнопки рядом с сообщением. */
  buttons?: InlineButton[][];
  /** Если задан — шлём в этот чат вместо SUPERADMIN_TELEGRAM_ID. */
  chatId?: number;
}

/**
 * Шлёт сообщение Данилу в @crescasuperadmin_bot.
 *
 * Требует две env переменные:
 *   - TELEGRAM_SUPERADMIN_BOT_TOKEN — токен бота @crescasuperadmin_bot
 *   - SUPERADMIN_TG_CHAT_ID — числовой Telegram ID получателя (переиспользуем
 *     существующую переменную — это тот же chat_id что для @cres_ca_bot,
 *     отличается только токен бота-отправителя)
 *
 * Если хоть одна не задана — функция тихо возвращает false (best-effort).
 */
export async function notifySuperadmin(
  text: string,
  opts: SendOpts = {},
): Promise<boolean> {
  const token = (process.env.TELEGRAM_SUPERADMIN_BOT_TOKEN ?? '').trim();
  const adminId = (process.env.SUPERADMIN_TG_CHAT_ID ?? '').trim();

  if (!token) {
    console.warn('[superadmin-notify] TELEGRAM_SUPERADMIN_BOT_TOKEN not set, skipping');
    return false;
  }

  const chatId = opts.chatId ?? (adminId ? Number(adminId) : NaN);
  if (!Number.isFinite(chatId)) {
    console.warn('[superadmin-notify] SUPERADMIN_TG_CHAT_ID not set or invalid, skipping');
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? 'HTML',
      disable_web_page_preview: true,
    };
    if (opts.buttons && opts.buttons.length > 0) {
      body.reply_markup = { inline_keyboard: opts.buttons };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('[superadmin-notify] send failed:', res.status, txt);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[superadmin-notify] error:', e);
    return false;
  }
}

/**
 * Шлёт ЛЮБОМУ пользователю через супер-бот (например, одобренному бета-тестировщику).
 * Не использует SUPERADMIN_TELEGRAM_ID — берёт chat_id из аргумента.
 */
export async function sendViaSuperadminBot(
  chatId: number,
  text: string,
  opts: Omit<SendOpts, 'chatId'> = {},
): Promise<boolean> {
  return notifySuperadmin(text, { ...opts, chatId });
}
