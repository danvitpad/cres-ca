/** --- YAML
 * name: Register superadmin bot webhook
 * description: Одноразовая ручка для регистрации webhook у @crescasuperadmin_bot.
 *              Идемпотентна — всегда указывает на нашу же фиксированную ссылку.
 *              Без специального auth-чека: безвредна (только setWebhook к нашему
 *              же URL), требует TELEGRAM_SUPERADMIN_BOT_TOKEN в env.
 *
 *              curl -X POST https://www.cres-ca.com/api/telegram/superadmin-webhook/setup
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';

export async function POST() {
  const token = (process.env.TELEGRAM_SUPERADMIN_BOT_TOKEN ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_SUPERADMIN_BOT_TOKEN not set' }, { status: 500 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cres-ca.com').trim();
  const webhookUrl = `${base.replace(/\/$/, '')}/api/telegram/superadmin-webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
    }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, status: res.status, webhookUrl, body });
}
