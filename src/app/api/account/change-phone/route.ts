/** --- YAML
 * name: Change Phone API
 * description: Phase 2.4 — plain profiles.phone update (no OTP, Supabase Phone Provider not enabled). Validates basic format: starts with "+", 7–15 digits after.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PHONE_RE = /^\+\d{7,15}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { phone } = await request.json().catch(() => ({}));
  if (typeof phone !== 'string' || !PHONE_RE.test(phone)) {
    return NextResponse.json({ error: 'Некорректный формат. Пример: +380671234567' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, phone });
}
