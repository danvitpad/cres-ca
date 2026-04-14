/** --- YAML
 * name: Telegram Link Existing — Password Sign-In
 * description: Called from Mini App welcome modal. Validates initData, signs user in with email+password via server client, then links telegram_id. Returns profile id.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isValidAsciiEmail } from '@/lib/errors';

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
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
    password?: string;
  };

  if (!body.initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  const tg = validateInitData(body.initData);
  if (!tg) return NextResponse.json({ error: 'invalid_init_data' }, { status: 403 });

  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidAsciiEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!body.password) return NextResponse.json({ error: 'missing_password' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Look up profile by email (case-insensitive)
  const { data: profile } = await admin
    .from('profiles')
    .select('id, telegram_id, role, public_id, email')
    .ilike('email', email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (profile.telegram_id && profile.telegram_id !== tg.id) {
    return NextResponse.json({ error: 'already_linked_other' }, { status: 409 });
  }

  // Attempt password sign-in on the server client so session cookies are set
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: profile.email ?? email,
    password: body.password,
  });

  if (signInErr) {
    return NextResponse.json({ error: 'wrong_password' }, { status: 401 });
  }

  // Link Telegram on the profile (only id/username/lang — respects original consent)
  await admin
    .from('profiles')
    .update({
      telegram_id: tg.id,
      telegram_username: tg.username ?? null,
      language_code: tg.language_code ?? null,
      telegram_linked_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  return NextResponse.json({
    userId: profile.id,
    role: profile.role,
    publicId: profile.public_id,
  });
}
