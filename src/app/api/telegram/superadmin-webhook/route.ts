/** --- YAML
 * name: Superadmin bot webhook
 * description: Webhook для @crescasuperadmin_bot. Обрабатывает callback'и под
 *              feedback-уведомлениями (Ответить / Готово) и пересылает ответы
 *              Данила пользователям через @crescacom_bot. Двусторонняя
 *              переписка с пользователем без раскрытия личного аккаунта Данила.
 *
 *              Flow:
 *                1) Под фидбеком кнопки: 💬 Ответить · 👤 Открыть TG · ✅ Готово
 *                2) Клик на «Ответить» → бот шлёт force_reply prompt с маркером
 *                   [fb:<id>] и сохраняет state {awaiting_reply_for: <id>}.
 *                3) Данил отвечает на этот prompt текстом → webhook ловит
 *                   reply_to_message с маркером, берёт feedback.tg_chat_id и
 *                   шлёт пользователю через @crescacom_bot. Сохраняет в
 *                   feedback_replies.
 *                4) Клик на «Готово» → проставляет feedback.done = true,
 *                   меняет текст уведомления (✅).
 *
 *              Webhook URL надо зарегистрировать один раз:
 *                curl -F "url=https://www.cres-ca.com/api/telegram/superadmin-webhook" \
 *                     "https://api.telegram.org/bot<TELEGRAM_SUPERADMIN_BOT_TOKEN>/setWebhook"
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

interface SuperadminUpdate {
  message?: {
    chat: { id: number };
    from: { id: number };
    text?: string;
    reply_to_message?: { text?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message: { chat: { id: number }; message_id: number; text?: string };
    data: string;
  };
}

function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function superadminToken() {
  return (process.env.TELEGRAM_SUPERADMIN_BOT_TOKEN ?? '').trim();
}

function clientBotToken() {
  return (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
}

async function tgFetch(token: string, method: string, body: Record<string, unknown>) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function POST(request: Request) {
  const update: SuperadminUpdate = await request.json().catch(() => ({}));

  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return NextResponse.json({ ok: true });
  }

  if (update.message) {
    await handleMessage(update.message);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleCallback(cb: NonNullable<SuperadminUpdate['callback_query']>) {
  const token = superadminToken();
  if (!token) return;

  // Acknowledge to clear loading spinner
  await tgFetch(token, 'answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

  const chatId = cb.message.chat.id;
  const data = cb.data;

  if (data.startsWith('fb_reply:')) {
    const feedbackId = data.split(':')[1];
    if (!feedbackId) return;

    const supabase = admin();
    await supabase.from('superadmin_state').upsert({
      chat_id: chatId,
      awaiting_reply_for: feedbackId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chat_id' });

    // Force-reply prompt — admin types reply, that message has reply_to_message
    // pointing to this prompt with the [fb:<id>] marker.
    await tgFetch(token, 'sendMessage', {
      chat_id: chatId,
      text: `Напишите ответ пользователю — он придёт ему через бот.\n\n[fb:${feedbackId}]`,
      reply_markup: { force_reply: true, selective: true },
    });
    return;
  }

  if (data.startsWith('fb_done:')) {
    const feedbackId = data.split(':')[1];
    if (!feedbackId) return;

    const supabase = admin();
    await supabase.from('feedback').update({ done: true }).eq('id', feedbackId);

    // Edit the original message — append a ✅ marker on the first line
    const originalText = cb.message.text ?? '';
    if (originalText) {
      const newText = originalText.startsWith('✅') ? originalText : `✅ ${originalText}`;
      await tgFetch(token, 'editMessageText', {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text: newText,
        parse_mode: 'HTML',
      }).catch(() => {});
    }
    return;
  }
}

async function handleMessage(msg: NonNullable<SuperadminUpdate['message']>) {
  const replyText = msg.reply_to_message?.text ?? '';
  const match = replyText.match(/\[fb:([0-9a-f-]{36})\]/i);
  if (!match || !msg.text) return;

  const feedbackId = match[1];
  const adminText = msg.text.trim();
  if (!adminText) return;

  const supabase = admin();
  const { data: fb } = await supabase
    .from('feedback')
    .select('tg_chat_id, profile_name')
    .eq('id', feedbackId)
    .maybeSingle<{ tg_chat_id: number | null; profile_name: string | null }>();

  if (!fb?.tg_chat_id) {
    await tgFetch(superadminToken(), 'sendMessage', {
      chat_id: msg.chat.id,
      text: '⚠️ Не могу отправить — у пользователя нет привязки к Telegram-боту.',
    });
    return;
  }

  // Relay to user via @crescacom_bot
  const clientToken = clientBotToken();
  if (!clientToken) {
    await tgFetch(superadminToken(), 'sendMessage', {
      chat_id: msg.chat.id,
      text: '⚠️ TELEGRAM_BOT_TOKEN не настроен — ответ не доставлен.',
    });
    return;
  }

  const userText = `💬 <b>Поддержка CRES-CA</b>\n\n${escapeHtml(adminText)}`;
  const sendRes = await tgFetch(clientToken, 'sendMessage', {
    chat_id: fb.tg_chat_id,
    text: userText,
    parse_mode: 'HTML',
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => '');
    console.error('[superadmin-webhook] forward failed:', sendRes.status, errText);
    await tgFetch(superadminToken(), 'sendMessage', {
      chat_id: msg.chat.id,
      text: `⚠️ Не удалось доставить ответ: ${sendRes.status}`,
    });
    return;
  }

  // Save to thread + clear pending state
  await supabase.from('feedback_replies').insert({
    feedback_id: feedbackId,
    direction: 'admin_to_user',
    body: adminText,
  });
  await supabase.from('superadmin_state')
    .update({ awaiting_reply_for: null, updated_at: new Date().toISOString() })
    .eq('chat_id', msg.chat.id);

  await tgFetch(superadminToken(), 'sendMessage', {
    chat_id: msg.chat.id,
    text: `✓ Отправлено пользователю${fb.profile_name ? ' ' + fb.profile_name : ''}.`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
