/** --- YAML
 * name: Currency Rates Cron
 * description: Daily fetch of FX rates (UAH base), upserts into currency_rates, then recalculates amount_base/price_base for payments, expenses, appointments using each master's base_currency.
 * created: 2026-04-12
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Rates = Record<string, number>;

function convert(amount: number, from: string, to: string, ratesUahBase: Rates): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return amount;
  // ratesUahBase: 1 UAH = X <code>, so <code> → UAH: amount / rate; UAH → <code>: amount * rate
  const fromRate = from === 'UAH' ? 1 : ratesUahBase[from];
  const toRate = to === 'UAH' ? 1 : ratesUahBase[to];
  if (!fromRate || !toRate) return null;
  const inUah = amount / fromRate;
  return inUah * toRate;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch('https://open.er-api.com/v6/latest/UAH', { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ error: 'fx fetch failed', status: res.status }, { status: 502 });
  }
  const payload = (await res.json()) as { result?: string; rates?: Rates };
  if (payload.result !== 'success' || !payload.rates) {
    return NextResponse.json({ error: 'bad fx payload' }, { status: 502 });
  }
  const rates = payload.rates;

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { error: upsertErr } = await supabase
    .from('currency_rates')
    .upsert({ date: today, rates }, { onConflict: 'date' });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  // Load all masters and their base currencies
  const { data: masters } = await supabase
    .from('masters')
    .select('id, base_currency');
  const baseByMaster = new Map<string, string>();
  for (const m of masters ?? []) {
    baseByMaster.set(m.id as string, (m.base_currency as string) ?? 'UAH');
  }

  let recalcPayments = 0;
  let recalcExpenses = 0;
  let recalcAppointments = 0;

  // Payments: linked via appointment.master_id
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, currency, appointment_id, appointments!inner(master_id)')
    .limit(5000);
  type PayRow = { id: string; amount: number | null; currency: string | null; appointments: { master_id: string } | { master_id: string }[] | null };
  for (const row of ((payments ?? []) as unknown) as PayRow[]) {
    const appt = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    const masterId = appt?.master_id;
    if (!masterId) continue;
    const base = baseByMaster.get(masterId) ?? 'UAH';
    const amt = Number(row.amount ?? 0);
    const cur = row.currency ?? base;
    const converted = convert(amt, cur, base, rates);
    if (converted === null) continue;
    const { error } = await supabase.from('payments').update({ amount_base: Number(converted.toFixed(2)) }).eq('id', row.id);
    if (!error) recalcPayments++;
  }

  // Expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, amount, currency, profile_id')
    .limit(5000);
  type ExpRow = { id: string; amount: number | null; currency: string | null; profile_id: string };
  const { data: mastersByProfile } = await supabase.from('masters').select('id, profile_id, base_currency');
  const baseByProfile = new Map<string, string>();
  for (const m of mastersByProfile ?? []) {
    if (m.profile_id) baseByProfile.set(m.profile_id as string, (m.base_currency as string) ?? 'UAH');
  }
  for (const row of ((expenses ?? []) as unknown) as ExpRow[]) {
    const base = baseByProfile.get(row.profile_id) ?? 'UAH';
    const amt = Number(row.amount ?? 0);
    const cur = row.currency ?? base;
    const converted = convert(amt, cur, base, rates);
    if (converted === null) continue;
    const { error } = await supabase.from('expenses').update({ amount_base: Number(converted.toFixed(2)) }).eq('id', row.id);
    if (!error) recalcExpenses++;
  }

  // Appointments
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, price, currency, master_id')
    .limit(5000);
  type ApptRow = { id: string; price: number | null; currency: string | null; master_id: string };
  for (const row of ((appts ?? []) as unknown) as ApptRow[]) {
    const base = baseByMaster.get(row.master_id) ?? 'UAH';
    const amt = Number(row.price ?? 0);
    const cur = row.currency ?? base;
    const converted = convert(amt, cur, base, rates);
    if (converted === null) continue;
    const { error } = await supabase.from('appointments').update({ price_base: Number(converted.toFixed(2)) }).eq('id', row.id);
    if (!error) recalcAppointments++;
  }

  return NextResponse.json({
    ok: true,
    date: today,
    base: 'UAH',
    count: Object.keys(rates).length,
    recalc: { payments: recalcPayments, expenses: recalcExpenses, appointments: recalcAppointments },
  });
}
