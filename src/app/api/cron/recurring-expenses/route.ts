/** --- YAML
 * name: Recurring Expenses Cron
 * description: Runs daily. For each active recurring_expenses row with day_of_month == today, posts a row into expenses (idempotent — skips if already posted this month). Updates last_posted_date.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = new Date();
  const dayOfMonth = today.getDate();
  const todayIso = today.toISOString().slice(0, 10);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const { data: recs, error } = await supabase
    .from('recurring_expenses')
    .select('id, master_id, name, amount, currency, category, last_posted_date')
    .eq('active', true)
    .eq('day_of_month', dayOfMonth);

  if (error || !recs?.length) {
    return NextResponse.json({ ok: true, posted: 0 });
  }

  let posted = 0;
  for (const r of recs) {
    if (r.last_posted_date && r.last_posted_date >= firstOfMonth) continue;

    const { error: insErr } = await supabase.from('expenses').insert({
      master_id: r.master_id,
      amount: r.amount,
      currency: r.currency || 'UAH',
      date: todayIso,
      description: r.name,
      vendor: null,
      category: r.category || 'Аренда',
    });

    if (!insErr) {
      await supabase
        .from('recurring_expenses')
        .update({ last_posted_date: todayIso })
        .eq('id', r.id);
      posted++;
    }
  }

  return NextResponse.json({ ok: true, posted });
}
