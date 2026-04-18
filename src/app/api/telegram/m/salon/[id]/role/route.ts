/** --- YAML
 * name: Mini App Salon Role API
 * description: POST — returns caller's role in a salon (admin/master/receptionist), salon info,
 *              and whether the caller is also a solo master (for Personal/Salon switcher).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const { initData } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', result.user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  const { data: salon } = await admin
    .from('salons')
    .select('id, name, logo_url, team_mode, owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let role: 'admin' | 'master' | 'receptionist' | null = null;
  if (salon.owner_id === profile.id) {
    role = 'admin';
  } else {
    const { data: member } = await admin
      .from('salon_members')
      .select('role')
      .eq('salon_id', salonId)
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();
    if (member) role = member.role as 'admin' | 'master' | 'receptionist';
  }

  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: soloMaster } = await admin
    .from('masters')
    .select('id, salon_id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  const isSoloMaster = Boolean(soloMaster && !soloMaster.salon_id);

  return NextResponse.json({
    salon: {
      id: salon.id,
      name: salon.name,
      logo_url: salon.logo_url,
      team_mode: salon.team_mode,
    },
    role,
    is_solo_master: isSoloMaster,
  });
}
