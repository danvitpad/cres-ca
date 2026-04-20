/** --- YAML
 * name: Partners List API
 * description: Returns current master's partnerships grouped by role/status — active / incoming (pending where I'm partner) / outgoing (pending where I'm initiator).
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabase.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Profile not set up' }, { status: 403 });

  const { data: rows, error } = await supabase
    .from('master_partnerships')
    .select(`
      id, master_id, partner_id, status, initiated_at, accepted_at, note,
      initiator:masters!master_partnerships_master_id_fkey(
        id, specialization, profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
      ),
      target:masters!master_partnerships_partner_id_fkey(
        id, specialization, profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
      )
    `)
    .or(`master_id.eq.${me.id},partner_id.eq.${me.id}`)
    .order('initiated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incoming: any[] = []; // pending and I'm the target
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outgoing: any[] = []; // pending and I'm initiator

  for (const r of rows || []) {
    const theyAreInitiator = r.master_id !== me.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const other = theyAreInitiator ? (r.initiator as any) : (r.target as any);

    const item = {
      id: r.id,
      status: r.status,
      note: r.note,
      initiated_at: r.initiated_at,
      accepted_at: r.accepted_at,
      partner: {
        id: other?.id,
        specialization: other?.specialization,
        full_name: other?.profile?.full_name,
        avatar_url: other?.profile?.avatar_url,
        slug: other?.profile?.slug,
      },
      youInitiated: !theyAreInitiator,
    };

    if (r.status === 'active') active.push(item);
    else if (r.status === 'pending' && theyAreInitiator) incoming.push(item);
    else if (r.status === 'pending' && !theyAreInitiator) outgoing.push(item);
  }

  return NextResponse.json({ active, incoming, outgoing });
}
