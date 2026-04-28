/** --- YAML
 * name: API onboarding finish
 * description: Финальная отметка завершения онбординга. Ставит
 *              profiles.onboarding_completed_at = now(). До этого момента
 *              proxy редиректит юзера на следующий нужный шаг.
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
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('onboarding_completed_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
