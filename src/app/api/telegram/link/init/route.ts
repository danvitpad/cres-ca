/** --- YAML
 * name: TelegramLinkInit
 * description: Генерирует одноразовый токен для привязки Telegram к веб-аккаунту мастера. Возвращает deeplink вида https://t.me/<bot>?start=linkmaster_<token>. Токен потребляется в /api/telegram/webhook.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const token = randomBytes(12).toString('hex');
  const { error } = await supabase
    .from('telegram_link_tokens')
    .insert({ token, profile_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cres_ca_bot';
  const deeplink = `https://t.me/${bot}?start=linkmaster_${token}`;

  return NextResponse.json({ ok: true, token, deeplink });
}
