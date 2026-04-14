/** --- YAML
 * name: Telegram Register — Verify Email OTP
 * description: Validates an 8-digit code, marks profile.email_verified_at
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = body.code?.trim();
  if (!code || !/^\d{8}$/.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const { data: otp } = await supabase
    .from('email_otps')
    .select('id, code, expires_at, verified_at, attempts, email')
    .eq('profile_id', user.id)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return NextResponse.json({ error: 'no_active_code' }, { status: 404 });
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  if (otp.attempts >= 5) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 });
  }

  if (otp.code !== code) {
    await supabase.from('email_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    return NextResponse.json({ error: 'wrong_code' }, { status: 400 });
  }

  const now = new Date().toISOString();
  await supabase.from('email_otps').update({ verified_at: now }).eq('id', otp.id);
  await supabase.from('profiles').update({ email_verified_at: now, email: otp.email }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}
