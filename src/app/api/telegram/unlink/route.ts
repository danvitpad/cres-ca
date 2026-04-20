/** --- YAML
 * name: Telegram Unlink (Hard Sign-Out)
 * description: Detaches caller's telegram_id from their profile so the next
 *              /telegram/auth ping doesn't auto-relink them back. Called from
 *              Mini App signOut flow BEFORE supabase.auth.signOut().
 *              Uses initData (Telegram HMAC) instead of cookie auth because
 *              Supabase cookies don't persist reliably inside the TG Webview.
 * created: 2026-04-20
 * updated: 2026-04-20
 * --- */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface TgUser { id: number }

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  if (!body.initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const tg = validateInitData(body.initData);
  if (!tg) return NextResponse.json({ error: 'invalid_init_data' }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Detach THIS tg.id from whatever profile currently holds it.
  const { error } = await admin
    .from('profiles')
    .update({ telegram_id: null, telegram_linked_at: null })
    .eq('telegram_id', tg.id);

  if (error) return NextResponse.json({ error: 'unlink_failed', detail: error.message }, { status: 500 });

  // Clear associated telegram_sessions row too.
  await admin.from('telegram_sessions').delete().eq('chat_id', tg.id);

  return NextResponse.json({ ok: true });
}
