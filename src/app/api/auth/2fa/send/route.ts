/** --- YAML
 * name: 2FA Send Code API
 * description: Phase 2.5 — generates a 6-digit code, stores SHA-256 hash in tg_2fa_codes, sends plaintext via @crescacom_bot sendMessage to the user's linked telegram_id. Called from (1) login after password success when tg_2fa_enabled, and (2) Security tab when user opts in (verifies delivery).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

export async function POST(request: Request) {
  const { profile_id } = await request.json().catch(() => ({}));
  if (!profile_id || typeof profile_id !== 'string') {
    return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, telegram_id, first_name')
    .eq('id', profile_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  if (!profile.telegram_id) {
    return NextResponse.json({ error: 'telegram_not_linked' }, { status: 400 });
  }

  // Generate 6-digit code, store hash, 5-min TTL.
  const code = String(randomInt(100000, 1000000));
  const codeHash = createHash('sha256').update(code).digest('hex');
  const { error: insertErr } = await admin.from('tg_2fa_codes').insert({
    profile_id: profile.id,
    code_hash: codeHash,
  });
  if (insertErr) {
    console.error('[2fa/send] insert failed', insertErr);
    return NextResponse.json({ error: 'store_failed' }, { status: 500 });
  }

  const text = `CRES-CA: код входа\n\n<b>${code}</b>\n\nКод действителен 5 минут. Если вы не пытались войти — игнорируйте это сообщение.`;
  const sent = await sendMessage(profile.telegram_id, text, { parse_mode: 'HTML' }).catch((e: unknown) => ({ ok: false, error: String(e) }));
  if (!sent?.ok) {
    console.error('[2fa/send] telegram sendMessage failed', sent);
    return NextResponse.json({ error: 'tg_send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
