/** --- YAML
 * name: Telegram Link Existing — Verify Email OTP
 * description: Validates initData + 8-digit code + email. On success, writes profiles.telegram_id (+ username, language, linked_at) so next /api/telegram/auth call sees this user as linked. Signs in via admin password reset → session cookies issued on server client.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

interface TgUser {
  id: number;
  username?: string;
  language_code?: string;
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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    initData?: string;
    email?: string;
    code?: string;
  };

  if (!body.initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }
  const tg = validateInitData(body.initData);
  if (!tg) return NextResponse.json({ error: 'invalid_init_data' }, { status: 403 });

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  if (!email || !code || !/^\d{8}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, public_id, telegram_id')
    .ilike('email', email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (profile.telegram_id && profile.telegram_id !== tg.id) {
    return NextResponse.json({ error: 'already_linked_other' }, { status: 409 });
  }

  const { data: otp } = await admin
    .from('email_otps')
    .select('id, code, expires_at, verified_at, attempts')
    .eq('profile_id', profile.id)
    .eq('email', email)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return NextResponse.json({ error: 'no_active_code' }, { status: 404 });
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  if (otp.attempts >= 5) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 });
  }
  if (otp.code !== code) {
    await admin.from('email_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    return NextResponse.json({ error: 'wrong_code' }, { status: 400 });
  }

  const now = new Date().toISOString();

  await admin.from('email_otps').update({ verified_at: now }).eq('id', otp.id);

  await admin
    .from('profiles')
    .update({
      telegram_id: tg.id,
      telegram_username: tg.username ?? null,
      language_code: tg.language_code ?? null,
      telegram_linked_at: now,
      email_verified_at: now,
    })
    .eq('id', profile.id);

  // Issue a fresh password and sign in the server client so cookies carry the session forward.
  const tempPassword = crypto.randomBytes(32).toString('hex');
  await admin.auth.admin.updateUserById(profile.id, { password: tempPassword });

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password: tempPassword });

  return NextResponse.json({
    ok: true,
    userId: profile.id,
    role: profile.role,
    publicId: profile.public_id,
  });
}
