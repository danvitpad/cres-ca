/** --- YAML
 * name: Telegram Master Stats API
 * description: Returns appointments + manual incomes/expenses for the stats
 *              screen. Возвращает unified `operations[]` для секции «Все
 *              операции» — каждая запись имеет {kind, amount, label, date,
 *              client?, ref}, отсортированы по date DESC.
 * created: 2026-04-17
 * updated: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(request: Request) {
  const { period } = await request.json().catch(() => ({}));
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin.from('masters').select('id').eq('profile_id', userId).maybeSingle();
  if (!master) return NextResponse.json({ appointments: [], operations: [], manual_income_total: 0 });

  const now = new Date();
  let from: Date;
  if (period === 'today') {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  const fromIso = from.toISOString();
  const fromDate = fromIso.slice(0, 10);
  const nowIso = now.toISOString();
  const nowDate = nowIso.slice(0, 10);

  type AptRow = {
    id: string; starts_at: string; status: string; price: number | null;
    service: { name: string } | { name: string }[] | null;
    client: { full_name: string | null } | { full_name: string | null }[] | null;
  };
  type ManualIncome = {
    id: string; amount: number | string; date: string; created_at: string;
    client_name: string | null; service_name: string | null; payment_method: string | null;
  };
  type ManualExpense = {
    id: string; amount: number | string; date: string; created_at: string;
    category: string | null; description: string | null; vendor: string | null;
  };

  const [aptRes, incomeRes, expenseRes] = await Promise.all([
    admin
      .from('appointments')
      .select('id, starts_at, status, price, service:services(name), client:clients(full_name)')
      .eq('master_id', master.id)
      .gte('starts_at', fromIso)
      .lte('starts_at', nowIso)
      .order('starts_at', { ascending: false }),
    admin
      .from('manual_incomes')
      .select('id, amount, date, created_at, client_name, service_name, payment_method')
      .eq('master_id', master.id)
      .gte('date', fromDate)
      .lte('date', nowDate)
      .order('date', { ascending: false }),
    admin
      .from('manual_expenses')
      .select('id, amount, date, created_at, category, description, vendor')
      .eq('master_id', master.id)
      .gte('date', fromDate)
      .lte('date', nowDate)
      .order('date', { ascending: false }),
  ]);

  const apts = (aptRes.data ?? []) as AptRow[];
  const incomes = (incomeRes.data ?? []) as ManualIncome[];
  const expenses = (expenseRes.data ?? []) as ManualExpense[];

  const manualTotal = incomes.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  // Unified operations list — для секции «Все операции» в Mini App.
  // Завершённые appointments → kind='visit', сумма = apt.price.
  // manual_incomes → kind='income'.
  // manual_expenses → kind='expense'.
  type Op = {
    id: string;
    kind: 'visit' | 'income' | 'expense';
    amount: number;
    label: string;
    sublabel: string | null;
    date: string;
  };
  const operations: Op[] = [];
  for (const a of apts) {
    if (a.status !== 'completed') continue;
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const cli = Array.isArray(a.client) ? a.client[0] : a.client;
    operations.push({
      id: `apt-${a.id}`,
      kind: 'visit',
      amount: Number(a.price ?? 0),
      label: svc?.name ?? 'Визит',
      sublabel: cli?.full_name ?? null,
      date: a.starts_at,
    });
  }
  for (const i of incomes) {
    operations.push({
      id: `inc-${i.id}`,
      kind: 'income',
      amount: Number(i.amount ?? 0),
      label: i.service_name || 'Доход',
      sublabel: [i.client_name, i.payment_method].filter(Boolean).join(' · ') || null,
      date: i.created_at || (i.date + 'T00:00:00Z'),
    });
  }
  for (const e of expenses) {
    operations.push({
      id: `exp-${e.id}`,
      kind: 'expense',
      amount: Number(e.amount ?? 0),
      label: e.description || e.category || 'Расход',
      sublabel: [e.category && e.description ? e.category : null, e.vendor].filter(Boolean).join(' · ') || null,
      date: e.created_at || (e.date + 'T00:00:00Z'),
    });
  }
  operations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    appointments: apts,
    operations,
    manual_income_total: manualTotal,
  });
}
