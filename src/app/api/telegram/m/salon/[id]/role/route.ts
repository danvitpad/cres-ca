/** --- YAML
 * name: Mini App Salon Role API
 * description: POST — returns caller's role in a salon (admin/master/receptionist), salon info,
 *              and whether the caller is also a solo master (for Personal/Salon switcher).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;

  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: salon } = await admin
    .from('salons')
    .select('id, name, logo_url, team_mode, owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let role: 'admin' | 'master' | 'receptionist' | null = null;
  if (salon.owner_id === userId) {
    role = 'admin';
  } else {
    const { data: member } = await admin
      .from('salon_members')
      .select('role')
      .eq('salon_id', salonId)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (member) role = member.role as 'admin' | 'master' | 'receptionist';
  }

  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: soloMaster } = await admin
    .from('masters')
    .select('id, salon_id')
    .eq('profile_id', userId)
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
