/** --- YAML
 * name: telegram-setup-route
 * description: One-shot admin endpoint — sets webhook URL + bot commands. Call with ?secret=<TELEGRAM_SETUP_SECRET>. Safe to re-run.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { setWebhook, getWebhookInfo } from '@/lib/telegram/bot';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setMyCommands() {
  const res = await fetch(`${API_BASE}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Запустить CRES-CA' },
        { command: 'help', description: 'Помощь' },
      ],
    }),
  });
  return res.json();
}

async function setChatMenuButton(webAppUrl: string) {
  const res = await fetch(`${API_BASE}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'CRES-CA',
        web_app: { url: webAppUrl },
      },
    }),
  });
  return res.json();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (secret !== process.env.TELEGRAM_SETUP_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`;
  const miniappUrl = `${process.env.NEXT_PUBLIC_APP_URL}/telegram`;
  const hook = await setWebhook(webhookUrl);
  const cmds = await setMyCommands();
  const menu = await setChatMenuButton(miniappUrl);
  const info = await getWebhookInfo();
  return NextResponse.json({ webhookUrl, miniappUrl, hook, cmds, menu, info });
}
