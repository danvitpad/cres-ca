/** --- YAML
 * name: Mini App — Master Partners List
 * description: Returns active + pending partnerships for the master Mini App. Uses initData.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { initData?: string } | null;
  if (!body?.initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

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

  const { data: rows, error } = await admin
    .from('master_partnerships')
    .select(`
      id, master_id, partner_id, status, initiated_at, accepted_at, cross_promotion,
      initiator:masters!master_partnerships_master_id_fkey(
        id, specialization, salon_id,
        profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
      ),
      target:masters!master_partnerships_partner_id_fkey(
        id, specialization, salon_id,
        profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
      )
    `)
    .or(`master_id.eq.${master.id},partner_id.eq.${master.id}`)
    .order('initiated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  interface SideProfile { full_name: string | null; avatar_url: string | null; slug: string | null }
  interface SideMaster {
    id: string;
    specialization: string | null;
    salon_id: string | null;
    profile: SideProfile | null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];
  for (const r of rows || []) {
    const youInitiated = r.master_id === master.id;
    const other = (youInitiated ? r.target : r.initiator) as unknown as SideMaster | null;
    items.push({
      id: r.id,
      status: r.status,
      cross_promotion: r.cross_promotion,
      youInitiated,
      partner: {
        id: other?.id ?? null,
        specialization: other?.specialization ?? null,
        is_team: !!other?.salon_id,
        full_name: other?.profile?.full_name ?? null,
        avatar_url: other?.profile?.avatar_url ?? null,
        slug: other?.profile?.slug ?? null,
      },
    });
  }
  return NextResponse.json({ partnerships: items });
}
