/** --- YAML
 * name: Telegram Auth API
 * description: Validates Telegram Mini App initData and returns/creates a Supabase session
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

function validateInitData(initData: string): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckArr = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hmac !== hash) return null;

  const userStr = params.get('user');
  if (!userStr) return null;

  return JSON.parse(userStr) as TelegramUser;
}

export async function POST(request: Request) {
  const { initData } = await request.json();

  if (!initData) {
    return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
  }

  const telegramUser = validateInitData(initData);
  if (!telegramUser) {
    return NextResponse.json({ error: 'Invalid initData' }, { status: 403 });
  }

  const supabase = await createClient();

  // Find existing profile by telegram_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('telegram_id', String(telegramUser.id))
    .single();

  if (profile) {
    // User exists — sign them in
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('profile_id', profile.id)
      .single();

    return NextResponse.json({
      userId: profile.id,
      role: profile.role,
      tier: sub?.tier || 'trial',
      isNew: false,
    });
  }

  // New user — create via Supabase auth with a pseudo-email
  const email = `tg_${telegramUser.id}@telegram.cres-ca.com`;
  const password = crypto.randomBytes(32).toString('hex');

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
        role: 'client',
        telegram_id: String(telegramUser.id),
      },
    },
  });

  if (signUpError || !authData.user) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  // Update telegram_id on profile
  await supabase
    .from('profiles')
    .update({ telegram_id: String(telegramUser.id) })
    .eq('id', authData.user.id);

  return NextResponse.json({
    userId: authData.user.id,
    role: 'client',
    tier: 'trial',
    isNew: true,
  });
}
