/** --- YAML
 * name: CRM Follow List
 * description: GET ?masterId=X&type=followers|mutual → list followers. GET ?profileId=X&type=following → list followed masters.
 * created: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const masterId = searchParams.get('masterId');
  const profileId = searchParams.get('profileId');

  if (type === 'followers' || type === 'mutual') {
    if (!masterId) return NextResponse.json({ error: 'missing_master_id' }, { status: 400 });

    let query = supabase
      .from('client_master_links')
      .select('profile_id, linked_at, master_follows_back, profiles:profiles!client_master_links_profile_id_fkey(id, full_name, avatar_url, phone, email)')
      .eq('master_id', masterId)
      .order('linked_at', { ascending: false })
      .limit(200);

    if (type === 'mutual') {
      query = query.eq('master_follows_back', true);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });

    const list = (data ?? []).map(row => ({
      profileId: row.profile_id,
      linkedAt: row.linked_at,
      mutual: row.master_follows_back,
      profile: row.profiles,
    }));

    return NextResponse.json({ list });
  }

  if (type === 'following') {
    const pid = profileId || user.id;

    const { data, error } = await supabase
      .from('client_master_links')
      .select('master_id, linked_at, master_follows_back, masters:masters!client_master_links_master_id_fkey(id, display_name, specialization, avatar_url, profiles(full_name, avatar_url))')
      .eq('profile_id', pid)
      .order('linked_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });

    const list = (data ?? []).map(row => ({
      masterId: row.master_id,
      linkedAt: row.linked_at,
      mutual: row.master_follows_back,
      master: row.masters,
    }));

    return NextResponse.json({ list });
  }

  return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
}
