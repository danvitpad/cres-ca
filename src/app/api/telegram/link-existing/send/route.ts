/** --- YAML
 * name: Telegram Link Existing — Send Email OTP
 * description: Called from Mini App welcome when user already has a web account. Validates initData, looks up profile by email, generates 8-digit OTP, sends via Resend. Silent success on unknown email (no enumeration).
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendOTPEmail } from '@/lib/email/resend';

const OTP_TTL_MS = 10 * 60 * 1000;

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

function validateInitData(initData: string): TgUser | null {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (hmac !== hash) return null;
  const userStr = params.get('user');
  if (!userStr) return null;
  return JSON.parse(userStr) as TgUser;
}

function generate8DigitCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += crypto.randomInt(0, 10).toString();
  return code;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    initData?: string;
    email?: string;
    locale?: string;
  };

  if (!body.initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }
  const tg = validateInitData(body.initData);
  if (!tg) return NextResponse.json({ error: 'invalid_init_data' }, { status: 403 });

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, telegram_id, email')
    .ilike('email', email)
    .maybeSingle();

  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  if (!profile) {
    return NextResponse.json({ ok: true, expiresAt });
  }

  if (profile.telegram_id && profile.telegram_id !== tg.id) {
    return NextResponse.json({ ok: true, expiresAt });
  }

  const code = generate8DigitCode();

  const { error: insertError } = await admin.from('email_otps').insert({
    profile_id: profile.id,
    email,
    code,
    expires_at: expiresAt,
  });
  if (insertError) {
    return NextResponse.json({ error: 'db_failed', detail: insertError.message }, { status: 500 });
  }

  try {
    await sendOTPEmail(email, code, body.locale ?? 'ru');
  } catch (e) {
    return NextResponse.json(
      { error: 'send_failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, expiresAt });
}
