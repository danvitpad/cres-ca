/** --- YAML
 * name: Master Team Invites — master-side list
 * description: GET /api/master-invites — current user's incoming pending invites
 *              from salons (joined to salon name + admin/inviter name).
 *              Returns empty list if user has no master row.
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
  const masterRow = master as { id: string } | null;
  if (!masterRow) return NextResponse.json({ invites: [] });

  const { data, error } = await supabase
    .from('master_team_invites')
    .select(`
      id, status, message, created_at, decided_at,
      salon:salons!master_team_invites_salon_id_fkey(
        id, name, city, logo_url, cover_url, bio, owner_id
      )
    `)
    .eq('master_id', masterRow.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invites: data ?? [] });
}
