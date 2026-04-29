/** --- YAML
 * name: Telegram Register — Send Email OTP
 * description: Generates an 8-digit code, saves to email_otps, sends via Resend. Called after /api/telegram/register when email was provided.
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendOTPEmail } from '@/lib/email/resend';

const OTP_TTL_MS = 10 * 60 * 1000;

function generate8DigitCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += crypto.randomInt(0, 10).toString();
  return code;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    locale?: string;
    userId?: string; // Mini App: передаётся явно после регистрации (cookie ненадёжен в TG WebView)
  };

  let userId: string | null = null;

  if (body.userId) {
    // Mini App flow: проверяем userId через admin-клиент, без зависимости от cookies
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user: adminUser } } = await admin.auth.admin.getUserById(body.userId);
    if (!adminUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    userId = adminUser.id;
  } else {
    // Web flow: сессия через cookies
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    userId = user.id;
  }

  const email = body.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const code = generate8DigitCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Используем admin-клиент для INSERT — работает независимо от сессии
  const dbAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: insertError } = await dbAdmin.from('email_otps').insert({
    profile_id: userId,
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
