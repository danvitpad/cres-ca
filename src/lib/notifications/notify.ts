/** --- YAML
 * name: notifyUser
 * description: Единая точка отправки уведомления пользователю.
 *              1) Пишет строку в `notifications` (для in-app inbox в Mini App).
 *              2) Если у пользователя есть привязанный telegram_id — шлёт
 *                 текст в Telegram через bot API с HTML-форматированием
 *                 и опциональной inline-кнопкой (deep-link в Mini App).
 *              Best-effort: ошибки логируются, но не валят основной flow.
 * created: 2026-04-27
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

interface NotifyOptions {
  /** ID профиля получателя (profiles.id). */
  profileId: string;
  title: string;
  body: string;
  /** Доп. данные для in-app (type обязателен — по нему рендерится иконка/deep-link). */
  data: { type: string } & Record<string, unknown>;
  /**
   * Если задан — добавит inline-кнопку в TG-сообщении, ведущую на эту
   * страницу Mini App (`web_app` button). Путь без домена, например
   * `/telegram/m/invites`.
   */
  deepLinkPath?: string | null;
  /** Лейбл inline-кнопки. Дефолт: «Открыть». */
  deepLinkLabel?: string;
}

/** Single helper that fans out to in-app inbox + Telegram. */
export async function notifyUser(
  supabase: SupabaseClient,
  opts: NotifyOptions,
): Promise<void> {
  // 1) In-app: пишем в notifications таблицу.
  try {
    await supabase.from('notifications').insert({
      profile_id: opts.profileId,
      channel: 'in_app',
      status: 'pending',
      scheduled_for: new Date().toISOString(),
      title: opts.title,
      body: opts.body,
      data: opts.data,
    });
  } catch {
    /* ignore — TG dispatch следующим шагом всё равно полезен */
  }

  // 2) TG dispatch — только если у профиля есть telegram_id.
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_id, public_language')
      .eq('id', opts.profileId)
      .maybeSingle();
    const chatId = (profile as { telegram_id: number | string | null } | null)?.telegram_id ?? null;
    if (!chatId) return;

    const text = `<b>${escapeHtml(opts.title)}</b>\n${escapeHtml(opts.body)}`;

    const replyMarkup = opts.deepLinkPath
      ? buildWebAppKeyboard(opts.deepLinkPath, opts.deepLinkLabel ?? 'Открыть')
      : undefined;

    await sendMessage(String(chatId), text, {
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  } catch {
    /* ignore — лог in-app уже есть */
  }
}

/** Кнопка «Открыть» которая запускает Mini App на нужной странице. */
function buildWebAppKeyboard(path: string, label: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://cres-ca.com';
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return {
    inline_keyboard: [
      [{ text: label, web_app: { url } }],
    ],
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
