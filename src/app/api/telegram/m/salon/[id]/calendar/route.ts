/** --- YAML
 * name: Mini App Salon Calendar API
 * description: POST — admin/receptionist only (via initData). Returns masters + appointments for a day.
 *              Used by the Mini App salon calendar screen.
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
  const body = await request.json().catch(() => ({}));
  const initData = body?.initData as string | undefined;
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  const fromParam = body?.from as string | undefined;
  const toParam = body?.to as string | undefined;

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });
  const tg = result.user;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles').select('id').eq('telegram_id', tg.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  const { data: salon } = await admin
    .from('salons').select('id, name, team_mode, owner_id').eq('id', salonId).maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let role: 'admin' | 'receptionist' | null = null;
  if (salon.owner_id === profile.id) role = 'admin';
  if (!role) {
    const { data: member } = await admin
      .from('salon_members')
      .select('role, status')
      .eq('salon_id', salonId)
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();
    if (member?.role === 'admin') role = 'admin';
    else if (member?.role === 'receptionist') role = 'receptionist';
  }
  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = toParam ? new Date(toParam) : new Date(from.getTime() + 86400000);

  const { data: masters } = await admin
    .from('masters')
    .select('id, display_name, avatar_url, specialization')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('display_name');

  const masterList = masters ?? [];
  const masterIds = masterList.map((m) => m.id);

  let appointments: Array<{
    id: string; master_id: string; status: string;
    starts_at: string; ends_at: string;
    client_name: string | null; service_name: string | null;
    created_by_role: string | null;
  }> = [];

  if (masterIds.length > 0) {
    const { data } = await admin
      .from('appointments')
      .select('id, master_id, status, starts_at, ends_at, created_by_role, clients(full_name), services(name)')
      .in('master_id', masterIds)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at');

    type Row = {
      id: string; master_id: string; status: string; starts_at: string; ends_at: string;
      created_by_role: string | null;
      clients: { full_name: string | null } | { full_name: string | null }[] | null;
      services: { name: string | null } | { name: string | null }[] | null;
    };

    appointments = ((data as Row[] | null) ?? []).map((r) => {
      const c = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const s = Array.isArray(r.services) ? r.services[0] : r.services;
      return {
        id: r.id,
        master_id: r.master_id,
        status: r.status,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        client_name: c?.full_name ?? null,
        service_name: s?.name ?? null,
        created_by_role: r.created_by_role,
      };
    });
  }

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    role,
    masters: masterList,
    appointments,
    range: { from: from.toISOString(), to: to.toISOString() },
  });
}
