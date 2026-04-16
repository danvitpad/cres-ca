/** --- YAML
 * name: CRM Follow Toggle
 * description: POST {masterId} → toggles client↔master follow. Creates notification on follow. Returns {following, mutual}.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { masterId?: string };
  const masterId = body.masterId?.trim();
  if (!masterId) return NextResponse.json({ error: 'invalid_master' }, { status: 400 });

  const { data: existing } = await supabase
    .from('client_master_links')
    .select('profile_id, master_follows_back')
    .eq('profile_id', user.id)
    .eq('master_id', masterId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('client_master_links')
      .delete()
      .eq('profile_id', user.id)
      .eq('master_id', masterId);
    return NextResponse.json({ following: false, mutual: false });
  }

  const { error } = await supabase
    .from('client_master_links')
    .insert({ profile_id: user.id, master_id: masterId });

  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  // Send notification to master
  const [{ data: profile }, { data: master }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('masters').select('profile_id').eq('id', masterId).maybeSingle(),
  ]);

  if (master?.profile_id) {
    const clientName = profile?.full_name || 'Клиент';
    await supabase.from('notifications').insert({
      profile_id: master.profile_id,
      channel: 'push',
      title: 'Новый подписчик',
      body: `${clientName} подписался на вас`,
      data: {
        type: 'new_follower',
        follower_profile_id: user.id,
        action_url: '/clients',
      },
    });
  }

  return NextResponse.json({ following: true, mutual: false });
}
