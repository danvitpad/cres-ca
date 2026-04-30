/** --- YAML
 * name: Welcome Complete
 * description: Помечает profiles.welcome_seen=true чтобы welcome-карусель
 *              больше не показывалась.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ welcome_seen: true })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
