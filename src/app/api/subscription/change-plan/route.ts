/** --- YAML
 * name: Subscription Change Plan (Hutko stub)
 * description: Phase 3 — stub. When hutko.org is live this will call their API to switch the plan mid-cycle. For now, logs the intent and returns { url: null, message }.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { plan_slug } = await request.json().catch(() => ({})) as { plan_slug?: string };
  if (!plan_slug) return NextResponse.json({ error: 'plan_slug_required' }, { status: 400 });

  console.log('[hutko] change-plan requested', { user: user.id, plan_slug });

  return NextResponse.json({
    url: null,
    message: 'Смена плана через hutko.org скоро будет доступна.',
    provider: 'hutko',
    stub: true,
  });
}
