/** --- YAML
 * name: My public page URL
 * description: Returns the master's own public marketplace URL + visibility state
 *              (visible | needs_subscription | hidden_manually). Used by dashboard banner.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id, slug, is_public, is_active')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) return NextResponse.json({ kind: 'not_master' });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, tier, trial_ends_at')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres-ca.com';
  const url = master.slug ? `${origin}/m/${master.slug}` : null;
  const subActive = sub?.status === 'active';

  let visibility: 'visible' | 'hidden_by_master' | 'needs_subscription' | 'no_slug';
  if (!master.slug) {
    visibility = 'no_slug';
  } else if (!master.is_public || !master.is_active) {
    visibility = 'hidden_by_master';
  } else if (!subActive) {
    visibility = 'needs_subscription';
  } else {
    visibility = 'visible';
  }

  return NextResponse.json({
    kind: 'master',
    slug: master.slug,
    url,
    visibility,
    tier: sub?.tier ?? null,
    trialEndsAt: sub?.trial_ends_at ?? null,
  });
}
