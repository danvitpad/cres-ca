/** --- YAML
 * name: Check Signup Allowed
 * description: Pre-signup gate. Принимает email и/или telegram_id, спрашивает БД-функцию
 *   is_signup_allowed. Если открыта регистрация всем — пропускает. Если в бета-листе
 *   как approved — пропускает. Иначе — отказ.
 *   Используется веб-логин-страницей перед supabase.auth.signUp и Mini App
 *   register endpoint'ом перед auth.admin.createUser.
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    telegram_id?: number | string;
  };

  const email = (body.email ?? '').trim().toLowerCase();
  const tgRaw = body.telegram_id;
  const tgId =
    typeof tgRaw === 'number'
      ? tgRaw
      : typeof tgRaw === 'string' && tgRaw.trim()
      ? Number(tgRaw)
      : null;

  if (!email && !tgId) {
    return NextResponse.json({ error: 'missing_email_or_tg' }, { status: 400 });
  }

  const db = admin();
  const { data, error } = await db.rpc('is_signup_allowed', {
    p_email: email || null,
    p_telegram_id: tgId,
  });

  if (error) {
    console.error('[check-signup-allowed] rpc error:', error);
    // Fail-closed: если RPC упал — НЕ пускаем (безопаснее так).
    return NextResponse.json(
      { allowed: false, reason: 'rpc_error', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
