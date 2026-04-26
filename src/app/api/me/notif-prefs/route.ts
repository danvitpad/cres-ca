/** --- YAML
 * name: Master Notification Preferences
 * description: GET / PATCH for profiles.notif_* toggles. Used by Mini App
 *              settings («Уведомления») to control which TG pushes the
 *              master gets about birthdays / appointments / new clients /
 *              payments / AI tips.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FIELDS = ['notif_birthdays', 'notif_appointments', 'notif_new_clients', 'notif_payments', 'notif_marketing_tips'] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data } = await supabase
    .from('profiles')
    .select(FIELDS.join(', '))
    .eq('id', user.id)
    .maybeSingle();
  return NextResponse.json(data ?? {});
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
