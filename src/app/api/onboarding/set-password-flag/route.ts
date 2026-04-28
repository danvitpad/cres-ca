/** --- YAML
 * name: API onboarding set-password-flag
 * description: Помечает profiles.password_set=true после успешного updateUser
 *              в /onboarding/set-password.
 * created: 2026-04-28
 * --- */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ password_set: true })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
