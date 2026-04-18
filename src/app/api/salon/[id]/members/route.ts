/** --- YAML
 * name: Salon Members API (list)
 * description: GET — admin-only. Lists salon members with profile + master info and per-week load.
 *              Used by /salon/[id]/team page.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, team_mode, owner_id, default_master_commission, owner_commission_percent, owner_rent_per_master')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: members } = await supabase
    .from('salon_members')
    .select('id, profile_id, master_id, role, status, commission_percent, rent_amount, joined_at, profiles(id, full_name, avatar_url), masters(id, display_name, avatar_url, specialization)')
    .eq('salon_id', salonId)
    .neq('status', 'removed')
    .order('joined_at', { ascending: true });

  type Row = {
    id: string; profile_id: string; master_id: string | null;
    role: 'admin' | 'master' | 'receptionist';
    status: 'pending' | 'active' | 'suspended';
    commission_percent: number | null; rent_amount: number | null;
    joined_at: string | null;
    profiles: { id: string; full_name: string | null; avatar_url: string | null } | { id: string; full_name: string | null; avatar_url: string | null }[] | null;
    masters: { id: string; display_name: string | null; avatar_url: string | null; specialization: string | null } | { id: string; display_name: string | null; avatar_url: string | null; specialization: string | null }[] | null;
  };

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
  weekStart.setHours(0, 0, 0, 0);

  const rows = (members as Row[] | null) ?? [];
  const masterIds = rows.map((r) => r.master_id).filter((x): x is string => !!x);

  const loadMap = new Map<string, number>();
  if (masterIds.length > 0) {
    const { data: appts } = await supabase
      .from('appointments')
      .select('master_id')
      .in('master_id', masterIds)
      .gte('starts_at', weekStart.toISOString())
      .not('status', 'eq', 'cancelled');
    for (const a of (appts ?? []) as Array<{ master_id: string }>) {
      loadMap.set(a.master_id, (loadMap.get(a.master_id) ?? 0) + 1);
    }
  }

  const normalized = rows.map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const master = Array.isArray(r.masters) ? r.masters[0] : r.masters;
    return {
      id: r.id,
      role: r.role,
      status: r.status,
      commission_percent: r.commission_percent,
      rent_amount: r.rent_amount,
      joined_at: r.joined_at,
      profile_id: r.profile_id,
      master_id: r.master_id,
      display_name: master?.display_name ?? profile?.full_name ?? null,
      avatar_url: master?.avatar_url ?? profile?.avatar_url ?? null,
      specialization: master?.specialization ?? null,
      appointments_week: r.master_id ? (loadMap.get(r.master_id) ?? 0) : 0,
      is_owner: r.profile_id === salon.owner_id,
    };
  });

  return NextResponse.json({
    salon: {
      id: salon.id,
      name: salon.name,
      team_mode: salon.team_mode,
      default_master_commission: salon.default_master_commission,
      owner_commission_percent: salon.owner_commission_percent,
      owner_rent_per_master: salon.owner_rent_per_master,
    },
    members: normalized,
  });
}
