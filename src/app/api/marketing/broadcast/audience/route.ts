/** --- YAML
 * name: Broadcast Audience Counter
 * description: GET — возвращает counts для UI, чтобы мастер видел сколько человек
 *              получит broadcast в каждой аудитории до отправки.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const [subs, favs, clients] = await Promise.all([
    supabase
      .from('client_master_links')
      .select('profile_id', { count: 'exact', head: true })
      .eq('master_id', master.id),
    supabase
      .from('client_favorites')
      .select('profile_id', { count: 'exact', head: true })
      .eq('master_id', master.id),
    supabase
      .from('clients')
      .select('profile_id', { count: 'exact', head: true })
      .eq('master_id', master.id)
      .not('profile_id', 'is', null),
  ]);

  return NextResponse.json({
    subscribers: subs.count ?? 0,
    favorites: favs.count ?? 0,
    all_clients: clients.count ?? 0,
  });
}
