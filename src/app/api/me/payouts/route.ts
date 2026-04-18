/** --- YAML
 * name: My Payouts API
 * description: GET — current master sees own payouts across salons (via masters.profile_id).
 *              Used by the finance page to surface "expected payout" banner in team mode.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ payouts: [] });

  const { data: masters } = await supabase
    .from('masters')
    .select('id, salon_id')
    .eq('profile_id', user.id)
    .not('salon_id', 'is', null);

  const masterIds = (masters ?? []).map((m) => m.id);
  if (masterIds.length === 0) return NextResponse.json({ payouts: [] });

  const { data } = await supabase
    .from('master_payouts')
    .select('id, master_id, salon_id, period_start, period_end, total_revenue, commission_percent, rent_amount, net_payout, status, paid_at, salons(name, team_mode)')
    .in('master_id', masterIds)
    .order('period_start', { ascending: false })
    .limit(12);

  type Row = {
    id: string; master_id: string; salon_id: string;
    period_start: string; period_end: string;
    total_revenue: number; commission_percent: number; rent_amount: number;
    net_payout: number; status: string; paid_at: string | null;
    salons: { name: string | null; team_mode: string | null } | { name: string | null; team_mode: string | null }[] | null;
  };

  const payouts = ((data as Row[] | null) ?? []).map((r) => {
    const salon = Array.isArray(r.salons) ? r.salons[0] : r.salons;
    return {
      id: r.id,
      salon_id: r.salon_id,
      salon_name: salon?.name ?? null,
      team_mode: salon?.team_mode ?? null,
      period_start: r.period_start,
      period_end: r.period_end,
      total_revenue: r.total_revenue,
      commission_percent: r.commission_percent,
      rent_amount: r.rent_amount,
      net_payout: r.net_payout,
      status: r.status,
      paid_at: r.paid_at,
    };
  });

  return NextResponse.json({ payouts });
}
