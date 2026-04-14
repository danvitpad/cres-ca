/** --- YAML
 * name: Financial CSV Export
 * description: Мастер скачивает CSV-файл с выручкой/расходами за период (month/quarter/custom). Открывается в Excel/Google Sheets. Поддерживает ?period=month|quarter|custom + from/to.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: master } = await supabase
    .from('masters')
    .select('id, tax_rate_percent')
    .eq('profile_id', user.id)
    .single();
  if (!master) return NextResponse.json({ error: 'Not a master' }, { status: 403 });

  const url = new URL(request.url);
  const period = url.searchParams.get('period') ?? 'month';
  const now = new Date();
  let from: Date;
  let to: Date;
  if (period === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    from = new Date(Date.UTC(now.getFullYear(), qStart, 1));
    to = new Date(Date.UTC(now.getFullYear(), qStart + 3, 1));
  } else if (period === 'custom') {
    from = new Date(url.searchParams.get('from') ?? now.toISOString());
    to = new Date(url.searchParams.get('to') ?? now.toISOString());
  } else {
    from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  }

  const [appointments, expenses] = await Promise.all([
    supabase
      .from('appointments')
      .select('starts_at, total_price, currency, clients(full_name), services(name)')
      .eq('master_id', master.id)
      .eq('status', 'completed')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at'),
    supabase
      .from('expenses')
      .select('date, amount, currency, category, description')
      .eq('master_id', master.id)
      .gte('date', from.toISOString())
      .lt('date', to.toISOString())
      .order('date'),
  ]);

  const rows: string[] = [];
  rows.push('Дата,Тип,Категория,Описание,Клиент,Сумма,Валюта');

  for (const a of appointments.data ?? []) {
    const client = (a.clients as unknown as { full_name: string | null } | null)?.full_name ?? '';
    const svc = (a.services as unknown as { name: string | null } | null)?.name ?? '';
    rows.push(
      [
        new Date(a.starts_at).toISOString().slice(0, 10),
        'Доход',
        'Услуга',
        svc,
        client,
        Number(a.total_price ?? 0).toFixed(2),
        a.currency ?? 'UAH',
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  for (const e of expenses.data ?? []) {
    rows.push(
      [
        new Date(e.date).toISOString().slice(0, 10),
        'Расход',
        e.category ?? '',
        e.description ?? '',
        '',
        `-${Number(e.amount ?? 0).toFixed(2)}`,
        e.currency ?? 'UAH',
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  const csv = '\uFEFF' + rows.join('\n');
  const filename = `finance-${period}-${from.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
