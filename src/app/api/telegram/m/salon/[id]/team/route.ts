/** --- YAML
 * name: Mini App Salon Team API
 * description: POST — admin-only. Returns team members (profile + master info, week load).
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
    .select('id, name, team_mode, owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let isAdmin = salon.owner_id === userId;
  if (!isAdmin) {
    const { data: m } = await admin
      .from('salon_members')
      .select('role, status')
      .eq('salon_id', salonId)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    isAdmin = m?.role === 'admin';
  }
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: members } = await admin
    .from('salon_members')
    .select(
      'id, profile_id, master_id, role, status, commission_percent, rent_amount, profiles:profiles!salon_members_profile_id_fkey(full_name, avatar_url), masters(display_name, avatar_url, specialization)',
    )
    .eq('salon_id', salonId)
    .neq('status', 'removed')
    .order('joined_at', { ascending: true });

  type Row = {
    id: string;
    profile_id: string;
    master_id: string | null;
    role: 'admin' | 'master' | 'receptionist';
    status: 'pending' | 'active' | 'suspended';
    commission_percent: number | null;
    rent_amount: number | null;
    profiles:
      | { full_name: string | null; avatar_url: string | null }
      | { full_name: string | null; avatar_url: string | null }[]
      | null;
    masters:
      | { display_name: string | null; avatar_url: string | null; specialization: string | null }
      | { display_name: string | null; avatar_url: string | null; specialization: string | null }[]
      | null;
  };

  const rows = (members as Row[] | null) ?? [];
  const masterIds = rows.map((r) => r.master_id).filter((x): x is string => !!x);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
  weekStart.setHours(0, 0, 0, 0);

  const loadMap = new Map<string, number>();
  if (masterIds.length > 0) {
    const { data: appts } = await admin
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
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const m = Array.isArray(r.masters) ? r.masters[0] : r.masters;
    return {
      id: r.id,
      role: r.role,
      status: r.status,
      commission_percent: r.commission_percent,
      rent_amount: r.rent_amount,
      display_name: m?.display_name ?? p?.full_name ?? null,
      avatar_url: m?.avatar_url ?? p?.avatar_url ?? null,
      specialization: m?.specialization ?? null,
      is_owner: r.profile_id === salon.owner_id,
      appointments_week: r.master_id ? (loadMap.get(r.master_id) ?? 0) : 0,
    };
  });

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    members: normalized,
  });
}
