/** --- YAML
 * name: Partnership Detail API
 * description: GET single partnership row with the "other" master expanded (profile, specialization, salon).
 *              Either side of the partnership can fetch.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: me } = await admin.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: row, error } = await admin
    .from('master_partnerships')
    .select(`
      id, master_id, partner_id, status, initiated_at, accepted_at, ended_at,
      note, contract_terms, commission_percent, promo_code, cross_promotion,
      initiator:masters!master_partnerships_master_id_fkey(
        id, specialization, vertical, bio, team_mode, salon_id,
        profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug, username)
      ),
      target:masters!master_partnerships_partner_id_fkey(
        id, specialization, vertical, bio, team_mode, salon_id,
        profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug, username)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.master_id !== me.id && row.partner_id !== me.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const youInitiated = row.master_id === me.id;
  const partner = youInitiated ? row.target : row.initiator;

  return NextResponse.json({
    partnership: {
      id: row.id,
      master_id: row.master_id,
      partner_id: row.partner_id,
      status: row.status,
      initiated_at: row.initiated_at,
      accepted_at: row.accepted_at,
      ended_at: row.ended_at,
      note: row.note,
      contract_terms: row.contract_terms,
      commission_percent: row.commission_percent,
      promo_code: row.promo_code,
      cross_promotion: row.cross_promotion,
      partner,
      youInitiated,
    },
  });
}
