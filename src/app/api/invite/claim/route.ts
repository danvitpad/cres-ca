/** --- YAML
 * name: invite-claim-route
 * description: Redeems the pending_invite cookie after login — auto-follows the master and records the referral.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const jar = await cookies();
  const raw = jar.get('pending_invite')?.value;
  if (!raw) return NextResponse.json({});

  let payload: { master_id?: string; ref?: string | null } = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    jar.delete('pending_invite');
    return NextResponse.json({});
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !payload.master_id) {
    jar.delete('pending_invite');
    return NextResponse.json({});
  }

  await supabase
    .from('client_master_links')
    .upsert({ profile_id: user.id, master_id: payload.master_id }, { onConflict: 'profile_id,master_id' });

  if (payload.ref && payload.ref !== user.id) {
    const { data: refClient } = await supabase
      .from('clients').select('id').eq('profile_id', payload.ref).maybeSingle();
    const { data: meClient } = await supabase
      .from('clients').select('id').eq('profile_id', user.id).maybeSingle();
    if (refClient?.id && meClient?.id) {
      await supabase.from('referrals').insert({
        referrer_client_id: refClient.id,
        referred_client_id: meClient.id,
        bonus_points: 0,
      }).then(() => {}, () => {});
    }
  }

  jar.delete('pending_invite');
  return NextResponse.json({ master_id: payload.master_id });
}
