/** --- YAML
 * name: Tour Dismiss
 * description: Marks a specific spotlight hint as seen in profiles.tour_progress.
 * created: 2026-04-30
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const spotlightId = body.spotlightId;
  if (!spotlightId || typeof spotlightId !== 'string') {
    return NextResponse.json({ error: 'missing spotlightId' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tour_progress')
    .eq('id', user.id)
    .maybeSingle();

  const progress = (profile as { tour_progress?: Record<string, boolean> } | null)?.tour_progress ?? {};
  progress[spotlightId] = true;

  await supabase
    .from('profiles')
    .update({ tour_progress: progress })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
