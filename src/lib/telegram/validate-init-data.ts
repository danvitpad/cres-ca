/** --- YAML
 * name: Telegram initData Validator
 * description: Shared HMAC validation for Telegram Mini App initData. Used by all /api/telegram/* routes.
 * created: 2026-04-16
 * --- */

import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export function validateInitData(
  initData: string,
): { user: TelegramUser } | { error: string } {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!botToken) return { error: 'no_bot_token' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { error: 'no_hash' };

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hmac !== hash) return { error: 'hash_mismatch' };

  const userStr = params.get('user');
  if (!userStr) return { error: 'no_user' };

  return { user: JSON.parse(userStr) as TelegramUser };
}
