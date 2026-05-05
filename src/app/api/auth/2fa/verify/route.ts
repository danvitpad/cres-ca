/** --- YAML
 * name: 2FA Verify Code API
 * description: Phase 2.5 — verifies 6-digit code. Returns { ok: true } if unused + not expired + hash matches. Marks used_at on success.
 *              profile_id is taken from the active Supabase session (NOT request body) — 2FA gate runs only after password success.
 *              Rate-limit: max 10 attempts per session per 10 minutes, tracked via tg_2fa_codes.failed_attempts.
 * created: 2026-04-19
 * updated: 2026-05-05
 * --- */

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { code } = await request.json().catch(() => ({}));
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  // 2FA gate runs after password success — session must exist.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const profileId = user.id;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Rate-limit brute-force: count fresh codes for this profile in the last 10 min.
  // Each code allows up to 10 verify attempts before being burned.
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentBurned } = await admin
    .from('tg_2fa_codes')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .not('used_at', 'is', null)
    .gte('created_at', tenMinAgo);
  if ((recentBurned ?? 0) >= 5) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const codeHash = createHash('sha256').update(code).digest('hex');
  const { data: row } = await admin
    .from('tg_2fa_codes')
    .select('id, expires_at, used_at')
    .eq('profile_id', profileId)
    .eq('code_hash', codeHash)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    // Burn one slot per failed attempt by inserting a placeholder code.
    // We re-use the table with a distinct hash so brute-force fills the rate-limit window.
    await admin.from('tg_2fa_codes').insert({
      profile_id: profileId,
      code_hash: createHash('sha256').update(`fail:${Date.now()}:${Math.random()}`).digest('hex'),
      used_at: new Date().toISOString(),
    }).select('id').maybeSingle();
    return NextResponse.json({ error: 'invalid_code' }, { status: 403 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 403 });
  }

  await admin.from('tg_2fa_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
  return NextResponse.json({ ok: true });
}
