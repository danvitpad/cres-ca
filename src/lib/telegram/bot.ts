/** --- YAML
 * name: Telegram Bot
 * description: Telegram Bot API helper functions for sending messages and setting webhook
 * --- */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: object;
}

export async function sendMessage(chatId: string | number, text: string, options?: SendMessageOptions) {
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...options,
    }),
  });
  return res.json();
}

/** Send a document by URL — used by broadcast/notification dispatch when notifications.data.attachment_urls is set. */
export async function sendDocument(chatId: string | number, documentUrl: string, caption?: string) {
  const res = await fetch(`${API_BASE}/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      document: documentUrl,
      caption: caption ?? undefined,
    }),
  });
  return res.json();
}

export async function setWebhook(url: string) {
  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function getWebhookInfo() {
  const res = await fetch(`${API_BASE}/getWebhookInfo`);
  return res.json();
}
