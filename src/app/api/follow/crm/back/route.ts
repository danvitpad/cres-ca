/** --- YAML
 * name: CRM Follow Back
 * description: POST {clientProfileId} → master follows back a client. DELETE → master unfollows client.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { clientProfileId?: string };
  const clientProfileId = body.clientProfileId?.trim();
  if (!clientProfileId) return NextResponse.json({ error: 'invalid_client' }, { status: 400 });

  // Verify caller is a master
  const { data: master } = await supabase
    .from('masters')
    .select('id, display_name, profiles(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });

  const { error } = await supabase
    .from('client_master_links')
    .update({
      master_follows_back: true,
      master_followed_back_at: new Date().toISOString(),
    })
    .eq('profile_id', clientProfileId)
    .eq('master_id', master.id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  // Notify client about mutual follow
  const masterProfile = master.profiles as unknown as { full_name: string } | null;
  const masterName = master.display_name || masterProfile?.full_name || 'Мастер';
  await supabase.from('notifications').insert({
    profile_id: clientProfileId,
    channel: 'push',
    title: 'Взаимная подписка',
    body: `${masterName} подписался на вас в ответ`,
    data: {
      type: 'mutual_follow',
      master_id: master.id,
      action_url: `/masters/${master.id}`,
    },
  });

  return NextResponse.json({ mutual: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientProfileId = searchParams.get('clientProfileId');
  if (!clientProfileId) return NextResponse.json({ error: 'invalid_client' }, { status: 400 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });

  await supabase
    .from('client_master_links')
    .update({
      master_follows_back: false,
      master_followed_back_at: null,
    })
    .eq('profile_id', clientProfileId)
    .eq('master_id', master.id);

  return NextResponse.json({ mutual: false });
}
