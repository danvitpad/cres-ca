/** --- YAML
 * name: Tour Reset
 * description: Resets tour_progress to {} and welcome_seen to false —
 *              replays the full onboarding flow.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await supabase
    .from('profiles')
    .update({ tour_progress: {}, welcome_seen: false })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
