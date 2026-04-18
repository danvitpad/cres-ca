/** --- YAML
 * name: Salon Finance API
 * description: GET — admin-only salon finance summary for a period. Revenue from appointments,
 *              expenses from expenses table (if any), per-master breakdown (unified: full;
 *              marketplace: aggregates without per-client mapping), payouts (existing rows).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

type Period = 'week' | 'month' | 'year';

function periodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  switch (period) {
    case 'week':
      from.setDate(now.getDate() - now.getDay() + 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'year':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'month':
    default:
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
  }
  return { from, to };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const periodParam = (url.searchParams.get('period') ?? 'month') as Period;
  const { from, to } = periodRange(periodParam);

  const supabase = await createClient();

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, team_mode, default_master_commission, owner_commission_percent, owner_rent_per_master')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const isUnified = salon.team_mode === 'unified';

  const { data: masters } = await supabase
    .from('masters')
    .select('id, display_name, profile_id')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('display_name');
  const masterList = masters ?? [];
  const masterIds = masterList.map((m) => m.id);

  const { data: members } = await supabase
    .from('salon_members')
    .select('master_id, commission_percent, rent_amount')
    .eq('salon_id', salonId)
    .eq('status', 'active');
  const memberMap = new Map(
    ((members ?? []) as Array<{ master_id: string | null; commission_percent: number | null; rent_amount: number | null }>)
      .filter((x) => x.master_id)
      .map((x) => [x.master_id as string, { commission_percent: x.commission_percent, rent_amount: x.rent_amount }]),
  );

  let appointments: Array<{ master_id: string; price: number | null; status: string; starts_at: string }> = [];
  if (masterIds.length > 0) {
    const { data } = await supabase
      .from('appointments')
      .select('master_id, price, status, starts_at')
      .in('master_id', masterIds)
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString());
    appointments = (data ?? []) as typeof appointments;
  }
  const completed = appointments.filter((a) => a.status === 'completed' || a.status === 'paid');

  let expenses = 0;
  if (isUnified && masterIds.length > 0) {
    const { data: exp } = await supabase
      .from('expenses')
      .select('amount, created_at')
      .in('master_id', masterIds)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());
    expenses = ((exp as Array<{ amount: number | null }> | null) ?? [])
      .reduce((acc, e) => acc + Number(e.amount ?? 0), 0);
  }

  const { data: existingPayouts } = await supabase
    .from('master_payouts')
    .select('id, master_id, total_revenue, commission_percent, commission_amount, rent_amount, net_payout, status, period_start, period_end')
    .eq('salon_id', salonId)
    .gte('period_start', from.toISOString().slice(0, 10))
    .lte('period_end', to.toISOString().slice(0, 10));
  type PayoutRow = {
    id: string; master_id: string; total_revenue: number; commission_percent: number;
    commission_amount: number; rent_amount: number; net_payout: number; status: string;
    period_start: string; period_end: string;
  };
  const payoutMap = new Map<string, PayoutRow>();
  for (const p of (existingPayouts as PayoutRow[] | null) ?? []) {
    payoutMap.set(p.master_id, p);
  }

  const perMaster = masterList.map((m) => {
    const mApps = completed.filter((a) => a.master_id === m.id);
    const revenue = mApps.reduce((acc, a) => acc + Number(a.price ?? 0), 0);
    const override = memberMap.get(m.id);
    const commissionPercent = isUnified
      ? (override?.commission_percent ?? Number(salon.default_master_commission ?? 50))
      : Number(salon.owner_commission_percent ?? 0);
    const rent = isUnified ? 0 : (override?.rent_amount ?? Number(salon.owner_rent_per_master ?? 0));
    const commissionAmount = isUnified
      ? revenue * (commissionPercent / 100)
      : revenue * (commissionPercent / 100);
    const netPayout = isUnified
      ? commissionAmount
      : Math.max(0, revenue - commissionAmount - rent);
    const existing = payoutMap.get(m.id);
    return {
      id: m.id,
      display_name: m.display_name,
      revenue,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      rent_amount: rent,
      net_payout: netPayout,
      payout: existing
        ? {
            id: existing.id,
            status: existing.status,
            net_payout: existing.net_payout,
            period_start: existing.period_start,
            period_end: existing.period_end,
          }
        : null,
    };
  });

  const totalRevenue = perMaster.reduce((acc, m) => acc + m.revenue, 0);
  const totalPayouts = perMaster.reduce((acc, m) => acc + m.net_payout, 0);
  const profit = totalRevenue - expenses - (isUnified ? totalPayouts : 0);

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    role,
    period: { from: from.toISOString(), to: to.toISOString(), key: periodParam },
    totals: {
      revenue: totalRevenue,
      expenses,
      payouts: totalPayouts,
      profit,
    },
    per_master: perMaster,
  });
}
