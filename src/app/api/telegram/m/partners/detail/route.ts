/** --- YAML
 * name: Mini App — Master Partner Detail
 * description: Single partnership detail with the "other" master expanded. Uses initData.
 *              Mirrors /api/partners/[id] GET but Mini App-style POST + initData.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { initData?: string; partnership_id?: string } | null;
  if (!body?.initData || !body?.partnership_id) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const result = validateInitData(body.initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'not_master' }, { status: 403 });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

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
    .eq('id', body.partnership_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.master_id !== master.id && row.partner_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const youInitiated = row.master_id === master.id;
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
