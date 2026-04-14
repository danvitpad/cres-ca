/** --- YAML
 * name: Quarterly Tax Report
 * description: Квартальный налоговый отчёт ФОП — суммирует выручку (completed appointments) за квартал, считает налог по ставке мастера (5%/18%), показывает breakdown по месяцам.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id, tax_rate_percent, tax_group, business_name, display_name')
    .eq('profile_id', user.id)
    .single();
  if (!master) return NextResponse.json({ error: 'Not a master' }, { status: 403 });

  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  const quarterParam = url.searchParams.get('quarter');
  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const q = quarterParam ? parseInt(quarterParam) : Math.floor(now.getMonth() / 3) + 1;

  const startMonth = (q - 1) * 3;
  const from = new Date(Date.UTC(year, startMonth, 1));
  const to = new Date(Date.UTC(year, startMonth + 3, 1));

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, starts_at, total_price, currency')
    .eq('master_id', master.id)
    .eq('status', 'completed')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString());

  const monthly: Record<string, { count: number; revenue: number }> = {};
  let total = 0;
  let count = 0;
  for (const a of appointments ?? []) {
    const key = new Date(a.starts_at).toISOString().slice(0, 7);
    monthly[key] = monthly[key] ?? { count: 0, revenue: 0 };
    monthly[key].count++;
    monthly[key].revenue += Number(a.total_price ?? 0);
    total += Number(a.total_price ?? 0);
    count++;
  }

  const taxRate = Number(master.tax_rate_percent ?? 5);
  const taxDue = (total * taxRate) / 100;

  return NextResponse.json({
    master_id: master.id,
    business_name: master.business_name ?? master.display_name,
    tax_group: master.tax_group,
    year,
    quarter: q,
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      appointments: count,
      revenue: Number(total.toFixed(2)),
      tax_rate_percent: taxRate,
      tax_due: Number(taxDue.toFixed(2)),
    },
    monthly_breakdown: Object.entries(monthly).map(([month, v]) => ({
      month,
      appointments: v.count,
      revenue: Number(v.revenue.toFixed(2)),
      tax: Number(((v.revenue * taxRate) / 100).toFixed(2)),
    })),
  });
}
