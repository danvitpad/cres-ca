/** --- YAML
 * name: Salon Payouts Generate API
 * description: POST — admin-only. Generates draft master_payouts for each active master for a given
 *              period. Reuses existing (master,period) rows if present (no duplicates).
 *              Recomputes totals based on completed appointments in the period.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

interface Body {
  period_start?: string; // YYYY-MM-DD
  period_end?: string;   // YYYY-MM-DD
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const periodStart = body.period_start ?? defaultStart;
  const periodEnd = body.period_end ?? defaultEnd;

  const supabase = await createClient();

  const { data: salon } = await supabase
    .from('salons')
    .select('id, team_mode, default_master_commission, owner_commission_percent, owner_rent_per_master')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const isUnified = salon.team_mode === 'unified';

  const { data: masters } = await supabase
    .from('masters')
    .select('id')
    .eq('salon_id', salonId)
    .eq('is_active', true);
  const masterIds = (masters ?? []).map((m) => m.id);
  if (masterIds.length === 0) return NextResponse.json({ created: 0, updated: 0 });

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

  const fromIso = new Date(`${periodStart}T00:00:00`).toISOString();
  const toIso = new Date(`${periodEnd}T23:59:59`).toISOString();

  const { data: appts } = await supabase
    .from('appointments')
    .select('master_id, price, status, starts_at')
    .in('master_id', masterIds)
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso);

  const byMaster = new Map<string, number>();
  for (const a of (appts ?? []) as Array<{ master_id: string; price: number | null; status: string }>) {
    if (a.status !== 'completed' && a.status !== 'paid') continue;
    byMaster.set(a.master_id, (byMaster.get(a.master_id) ?? 0) + Number(a.price ?? 0));
  }

  let created = 0;
  let updated = 0;

  for (const masterId of masterIds) {
    const revenue = byMaster.get(masterId) ?? 0;
    const override = memberMap.get(masterId);
    const commissionPercent = isUnified
      ? Number(override?.commission_percent ?? salon.default_master_commission ?? 50)
      : Number(salon.owner_commission_percent ?? 0);
    const rent = isUnified ? 0 : Number(override?.rent_amount ?? salon.owner_rent_per_master ?? 0);
    const commissionAmount = revenue * (commissionPercent / 100);
    const netPayout = isUnified ? commissionAmount : Math.max(0, revenue - commissionAmount - rent);

    const { data: existing } = await supabase
      .from('master_payouts')
      .select('id, status')
      .eq('salon_id', salonId)
      .eq('master_id', masterId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'paid') continue;
      await supabase
        .from('master_payouts')
        .update({
          total_revenue: revenue,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          rent_amount: rent,
          net_payout: netPayout,
        })
        .eq('id', existing.id);
      updated += 1;
    } else {
      const { error } = await supabase.from('master_payouts').insert({
        salon_id: salonId,
        master_id: masterId,
        period_start: periodStart,
        period_end: periodEnd,
        total_revenue: revenue,
        commission_percent: commissionPercent,
        commission_amount: commissionAmount,
        rent_amount: rent,
        net_payout: netPayout,
        status: 'draft',
      });
      if (!error) created += 1;
    }
  }

  return NextResponse.json({ created, updated, period_start: periodStart, period_end: periodEnd });
}
