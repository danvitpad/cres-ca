/** --- YAML
 * name: Telegram Auth API
 * description: Validates Telegram Mini App initData and looks up existing profile. Does NOT create users — returns {linked, needsRegistration, tgData} so the client can drive the consent/register flow.
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

function validateInitData(
  initData: string,
): { user: TelegramUser } | { error: string; debug?: Record<string, unknown> } {
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

export async function POST(request: Request) {
  const { initData } = await request.json();
  if (!initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const tg = result.user;

  // Use admin client to bypass RLS — identity is already proven via initData HMAC.
  // The server client (anon key + cookies) fails in Telegram WebView because
  // the embedded browser doesn't reliably persist Supabase session cookies.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, full_name, first_name, last_name, phone, public_id, date_of_birth')
    .eq('telegram_id', tg.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({
      linked: false,
      needsRegistration: true,
      tgData: {
        id: tg.id,
        first_name: tg.first_name,
        last_name: tg.last_name ?? null,
        username: tg.username ?? null,
        photo_url: tg.photo_url ?? null,
        language_code: tg.language_code ?? null,
      },
    });
  }

  // Record telegram session: this chat_id → this CRES-CA profile
  // In private chats, chat_id == user_id
  await admin
    .from('telegram_sessions')
    .upsert({ chat_id: tg.id, profile_id: profile.id, logged_in_at: new Date().toISOString() }, { onConflict: 'chat_id' });

  const needsPhone = !profile.phone;

  const { data: sub } = await admin
    .from('subscriptions')
    .select('tier')
    .eq('profile_id', profile.id)
    .maybeSingle();

  return NextResponse.json({
    linked: true,
    needsRegistration: needsPhone,
    userId: profile.id,
    role: profile.role,
    tier: sub?.tier ?? 'trial',
    publicId: profile.public_id,
    fullName: profile.first_name || profile.full_name,
    firstName: profile.first_name,
    lastName: profile.last_name,
    missing: needsPhone ? ['phone'] : [],
  });
}
