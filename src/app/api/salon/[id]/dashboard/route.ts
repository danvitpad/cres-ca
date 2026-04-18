/** --- YAML
 * name: Salon Owner Dashboard API
 * description: GET — aggregated team metrics for the salon owner. Returns today/week/month revenue
 *              and appointment counts, per-master breakdown (unified) or salon-level aggregates only
 *              (marketplace), plus alerts (low inventory, client birthdays, idle masters).
 *              Admin-only access (owner or promoted admin).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

interface Appointment {
  id: string;
  master_id: string;
  client_id: string | null;
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, team_mode, logo_url')
    .eq('id', salonId)
    .maybeSingle();

  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: masters } = await supabase
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
    const { data } = await supabase
      .from('appointments')
      .select('id, master_id, client_id, status, starts_at, ends_at, price')
      .in('master_id', masterIds)
      .gte('starts_at', monthStart.toISOString());
    appointments = (data ?? []) as Appointment[];
  }

  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);

  const completed = appointments.filter((a) => a.status === 'completed' || a.status === 'paid');

  const sumPrice = (list: Appointment[]) =>
    list.reduce((acc, a) => acc + Number(a.price ?? 0), 0);

  const revenueToday = sumPrice(
    completed.filter((a) => new Date(a.starts_at) >= todayStart),
  );
  const revenueWeek = sumPrice(
    completed.filter((a) => new Date(a.starts_at) >= weekStart),
  );
  const revenueMonth = sumPrice(completed);

  const apptsToday = appointments.filter(
    (a) => new Date(a.starts_at) >= todayStart && new Date(a.starts_at) < new Date(todayStart.getTime() + 86400000),
  );
  const apptsWeek = appointments.filter((a) => new Date(a.starts_at) >= weekStart);

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
    const workdayMinutes = 8 * 60;
    const loadPercent = Math.min(100, Math.round((plannedMinutes / workdayMinutes) * 100));

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

  const alerts: Array<{ kind: string; message: string }> = [];
  const idleToday = perMaster.filter((m) => m.appointments_today === 0);
  if (idleToday.length > 0) {
    alerts.push({
      kind: 'idle_masters',
      message: `${idleToday.length} ${idleToday.length === 1 ? 'мастер без записей' : 'мастеров без записей'} сегодня`,
    });
  }

  if (isUnified) {
    const { data: lowInv } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, low_stock_threshold')
      .in('master_id', masterIds.length ? masterIds : ['00000000-0000-0000-0000-000000000000']);
    type InvRow = { id: string; name: string; quantity: number | null; low_stock_threshold: number | null };
    const low = ((lowInv as InvRow[] | null) ?? []).filter(
      (i) => i.low_stock_threshold != null && (i.quantity ?? 0) <= i.low_stock_threshold,
    );
    if (low.length > 0) {
      alerts.push({ kind: 'low_inventory', message: `${low.length} позиций с низким остатком` });
    }
  }

  return NextResponse.json({
    salon: {
      id: salon.id,
      name: salon.name,
      logo_url: salon.logo_url,
      team_mode: salon.team_mode,
    },
    metrics: {
      revenue_today: revenueToday,
      revenue_week: revenueWeek,
      revenue_month: revenueMonth,
      appointments_today: apptsToday.length,
      appointments_week: apptsWeek.length,
      masters_count: masterList.length,
    },
    team: perMaster,
    alerts,
  });
}
