/** --- YAML
 * name: Mini App Salon Finance API
 * description: POST — admin-only. Returns period totals and per-master payout line items for the Mini App.
 *              Shape intentionally mirrors /api/salon/[id]/finance with fewer fields.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

type Period = 'week' | 'month' | 'year';

function periodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  if (period === 'week') {
    const day = from.getDay() || 7;
    from.setDate(from.getDate() - day + 1);
    from.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const body = await request.json().catch(() => ({}));
  const initData = body.initData as string | undefined;
  const period = (body.period ?? 'month') as Period;
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
    .select('id, name, team_mode, owner_id, default_master_commission, owner_commission_percent, owner_rent_per_master')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let isAdmin = salon.owner_id === profile.id;
  if (!isAdmin) {
    const { data: m } = await admin
      .from('salon_members')
      .select('role, status')
      .eq('salon_id', salonId)
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();
    isAdmin = m?.role === 'admin';
  }
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { from, to } = periodRange(period);
  const isUnified = salon.team_mode === 'unified';

  const { data: masters } = await admin
    .from('masters')
    .select('id, display_name, avatar_url')
    .eq('salon_id', salonId);
  const masterList = (masters ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
  const masterIds = masterList.map((m) => m.id);

  const byMaster = new Map<string, number>();
  if (masterIds.length > 0) {
    const { data: appts } = await admin
      .from('appointments')
      .select('master_id, price, status')
      .in('master_id', masterIds)
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString());
    for (const a of (appts ?? []) as Array<{ master_id: string; price: number | null; status: string }>) {
      if (a.status !== 'completed' && a.status !== 'paid') continue;
      byMaster.set(a.master_id, (byMaster.get(a.master_id) ?? 0) + Number(a.price ?? 0));
    }
  }

  const { data: expenseRows } = await admin
    .from('expenses')
    .select('amount')
    .eq('salon_id', salonId)
    .gte('occurred_at', from.toISOString().slice(0, 10))
    .lte('occurred_at', to.toISOString().slice(0, 10));
  const expenses = (expenseRows ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const { data: members } = await admin
    .from('salon_members')
    .select('master_id, commission_percent, rent_amount')
    .eq('salon_id', salonId)
    .eq('status', 'active');
  const memberMap = new Map(
    ((members ?? []) as Array<{ master_id: string | null; commission_percent: number | null; rent_amount: number | null }>)
      .filter((x) => x.master_id)
      .map((x) => [x.master_id as string, x]),
  );

  let revenue = 0;
  let payoutsTotal = 0;
  const perMaster = masterList.map((m) => {
    const mrev = byMaster.get(m.id) ?? 0;
    revenue += mrev;
    const ov = memberMap.get(m.id);
    const commissionPercent = isUnified
      ? Number(ov?.commission_percent ?? salon.default_master_commission ?? 50)
      : Number(salon.owner_commission_percent ?? 0);
    const rent = isUnified ? 0 : Number(ov?.rent_amount ?? salon.owner_rent_per_master ?? 0);
    const commissionAmount = mrev * (commissionPercent / 100);
    const net = isUnified ? commissionAmount : Math.max(0, mrev - commissionAmount - rent);
    payoutsTotal += net;
    return {
      master_id: m.id,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      revenue: mrev,
      net_payout: net,
    };
  });

  const profit = isUnified ? revenue - expenses - payoutsTotal : revenue - payoutsTotal - expenses;

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    period,
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: { revenue, expenses, payouts: payoutsTotal, profit },
    masters: perMaster,
  });
}
