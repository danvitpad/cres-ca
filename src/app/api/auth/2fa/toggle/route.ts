/** --- YAML
 * name: 2FA Toggle API
 * description: Phase 2.5 — enable or disable tg_2fa_enabled on the authenticated user's profile. Enabling requires a valid code just delivered via /api/auth/2fa/send to prove delivery works.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { enable, code } = await request.json().catch(() => ({}));

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (enable) {
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'code_required' }, { status: 400 });
    }
    const codeHash = createHash('sha256').update(code).digest('hex');
    const { data: row } = await admin
      .from('tg_2fa_codes')
      .select('id, expires_at, used_at')
      .eq('profile_id', user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'invalid_or_expired' }, { status: 403 });
    }
    await admin.from('tg_2fa_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
  }

  const { error } = await admin
    .from('profiles')
    .update({ tg_2fa_enabled: !!enable })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, enabled: !!enable });
}
