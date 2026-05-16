/** --- YAML
 * name: Client Privacy Preferences
 * description: GET → reads profiles.privacy_* columns.
 *              PATCH → updates one or more privacy flags.
 *              Used by client Mini App settings/privacy page.
 * created: 2026-05-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FIELDS = [
  'privacy_profile_visible',
  'privacy_show_visit_history',
  'privacy_show_in_reviews',
  'privacy_share_with_team',
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('profiles')
    .select(FIELDS.join(', '))
    .eq('id', user.id)
    .maybeSingle();

  const row = data as Record<string, boolean> | null;
  return NextResponse.json({
    privacy_profile_visible:    row?.privacy_profile_visible    ?? true,
    privacy_show_visit_history: row?.privacy_show_visit_history ?? true,
    privacy_show_in_reviews:    row?.privacy_show_in_reviews    ?? true,
    privacy_share_with_team:    row?.privacy_share_with_team    ?? false,
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const update: Record<string, boolean> = {};
  for (const f of FIELDS) {
    if (f in body) update[f] = Boolean(body[f]);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...update });
}
