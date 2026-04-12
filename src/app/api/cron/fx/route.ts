/** --- YAML
 * name: Currency Rates Cron
 * description: Daily fetch of FX rates (UAH base) from open.er-api.com, upserts into currency_rates by date.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch('https://open.er-api.com/v6/latest/UAH', { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ error: 'fx fetch failed', status: res.status }, { status: 502 });
  }
  const payload = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (payload.result !== 'success' || !payload.rates) {
    return NextResponse.json({ error: 'bad fx payload' }, { status: 502 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { error } = await supabase
    .from('currency_rates')
    .upsert({ date: today, rates: payload.rates }, { onConflict: 'date' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, date: today, base: 'UAH', count: Object.keys(payload.rates).length });
}
