/** --- YAML
 * name: 2FA Verify Code API
 * description: Phase 2.5 — verifies 6-digit code. Returns { ok: true } if unused + not expired + hash matches. Marks used_at on success.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { profile_id, code } = await request.json().catch(() => ({}));
  if (!profile_id || !code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const codeHash = createHash('sha256').update(code).digest('hex');
  const { data: row } = await admin
    .from('tg_2fa_codes')
    .select('id, expires_at, used_at')
    .eq('profile_id', profile_id)
    .eq('code_hash', codeHash)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'invalid_code' }, { status: 403 });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 403 });
  }

  await admin.from('tg_2fa_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
  return NextResponse.json({ ok: true });
}
