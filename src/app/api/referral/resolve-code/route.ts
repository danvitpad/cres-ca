/** --- YAML
 * name: Resolve referral code → profile_id
 * description: GET /api/referral/resolve-code?code=<invite_code|uuid>. Принимает либо
 *              referral_code (короткий читаемый код), либо profile_id (UUID). Возвращает
 *              { profile_id } если найден. Используется RefCapture на странице мастера,
 *              чтобы превратить /m/danil?ref=ABC123 → cres_ref=<UUID> в sessionStorage.
 * created: 2026-04-26
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const CODE_RE = /^[a-z0-9_-]{3,64}$/i;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim();
  if (!code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 });
  }

  if (UUID_RE.test(code)) {
    return NextResponse.json({ profile_id: code });
  }

  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('referral_code', code.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(
    { profile_id: profile.id },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
  );
}
