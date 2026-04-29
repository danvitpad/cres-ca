/** --- YAML
 * name: Superadmin login (username/password)
 * description: Принимает {username, password}. Если username совпадает с
 *   env SA_LOGIN_USERNAME (constant-time compare) — мапит на скрытый
 *   email SA_INTERNAL_EMAIL и логинит через supabase.auth.signInWithPassword.
 *   После успешного логина — обычная Supabase сессия + cookies, и
 *   /superadmin/* пропускают как обычно (через isSuperadminEmail).
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function constTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  const username = (body.username ?? '').trim();
  const password = body.password ?? '';

  if (!username || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
  }

  const expectedUsername = (process.env.SA_LOGIN_USERNAME ?? '').trim();
  const internalEmail = (process.env.SA_INTERNAL_EMAIL ?? 'sa@cres-ca.system').trim();

  if (!expectedUsername) {
    console.warn('[sa-login] SA_LOGIN_USERNAME not set — superadmin login disabled');
    return NextResponse.json({ error: 'login_disabled' }, { status: 503 });
  }

  // Username check — constant-time
  if (!constTimeEq(username, expectedUsername)) {
    // Generic error на любую неудачу, чтобы атакующий не знал что не так
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  // Делегируем проверку пароля Supabase'у через signInWithPassword.
  // Этот вызов установит auth-куки на ответе.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  });

  if (error) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, redirectTo: '/ru/superadmin/dashboard' });
}
