/** --- YAML
 * name: Restore Account API
 * description: Phase 2.6 — clears profiles.deleted_at so the scheduled 30-day purge skips this account. Called from the "account pending deletion" dialog on login.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ deleted_at: null })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
