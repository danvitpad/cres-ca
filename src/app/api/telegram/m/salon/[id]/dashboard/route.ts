/** --- YAML
 * name: Mini App Salon Dashboard API
 * description: POST — aggregated team metrics for salon admin in the Mini App. Validates initData,
 *              verifies caller is salon owner or admin (via salon_members), returns same shape as web dashboard.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

interface Appointment {
  id: string;
  master_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  price: number | null;
}

interface MasterLite {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
  profile_id: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay() || 7;
  x.setDate(x.getDate() - day + 1);
  return x;
}

function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const { initData } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const tg = result.user;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  const { data: salon } = await admin
    .from('salons')
    .select('id, name, team_mode, logo_url, owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let isAdmin = salon.owner_id === profile.id;
  if (!isAdmin) {
    const { data: member } = await admin
      .from('salon_members')
      .select('role, status')
      .eq('salon_id', salonId)
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();
    isAdmin = member?.role === 'admin';
  }
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: masters } = await admin
    .from('masters')
    .select('id, display_name, avatar_url, specialization, profile_id')
    .eq('salon_id', salonId)
    .eq('is_active', true);

  const masterList = (masters ?? []) as MasterLite[];
  const masterIds = masterList.map((m) => m.id);

  const now = new Date();
  const monthStart = startOfMonth(now);

  let appointments: Appointment[] = [];
  if (masterIds.length > 0) {
    const { data } = await admin
      .from('appointments')
      .select('id, master_id, status, starts_at, ends_at, price')
      .in('master_id', masterIds)
      .gte('starts_at', monthStart.toISOString());
    appointments = (data ?? []) as Appointment[];
  }

  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const completed = appointments.filter((a) => a.status === 'completed' || a.status === 'paid');

  const sumPrice = (list: Appointment[]) =>
    list.reduce((acc, a) => acc + Number(a.price ?? 0), 0);

  const isUnified = salon.team_mode === 'unified';

  const perMaster = masterList.map((m) => {
    const mApps = appointments.filter((a) => a.master_id === m.id);
    const mToday = mApps.filter(
      (a) => new Date(a.starts_at) >= todayStart && new Date(a.starts_at) < new Date(todayStart.getTime() + 86400000),
    );
    const mCompletedToday = mToday.filter((a) => a.status === 'completed' || a.status === 'paid');
    const plannedMinutes = mToday.reduce((acc, a) => {
      const start = new Date(a.starts_at).getTime();
      const end = new Date(a.ends_at).getTime();
      return acc + Math.max(0, (end - start) / 60000);
    }, 0);
    const loadPercent = Math.min(100, Math.round((plannedMinutes / (8 * 60)) * 100));

    return {
      id: m.id,
      profile_id: m.profile_id,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      specialization: m.specialization,
      appointments_today: mToday.length,
      revenue_today: isUnified ? sumPrice(mCompletedToday) : null,
      load_percent: loadPercent,
    };
  });

  return NextResponse.json({
    salon: {
      id: salon.id,
      name: salon.name,
      logo_url: salon.logo_url,
      team_mode: salon.team_mode,
    },
    metrics: {
      revenue_today: sumPrice(completed.filter((a) => new Date(a.starts_at) >= todayStart)),
      revenue_week: sumPrice(completed.filter((a) => new Date(a.starts_at) >= weekStart)),
      revenue_month: sumPrice(completed),
      appointments_today: appointments.filter(
        (a) => new Date(a.starts_at) >= todayStart && new Date(a.starts_at) < new Date(todayStart.getTime() + 86400000),
      ).length,
      appointments_week: appointments.filter((a) => new Date(a.starts_at) >= weekStart).length,
      masters_count: masterList.length,
    },
    team: perMaster,
  });
}
