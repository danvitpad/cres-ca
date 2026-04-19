/** --- YAML
 * name: Telegram Master Finance Entry API
 * description: POST manual income (→ manual_incomes) or expense (→ expenses) from the master Mini App FAB forms.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

type IncomePayload = {
  kind: 'income';
  amount: number;
  client_name?: string | null;
  service_name?: string | null;
  payment_method?: string | null;
  note?: string | null;
};

type ExpensePayload = {
  kind: 'expense';
  amount: number;
  category?: string | null;
  description?: string | null;
  vendor?: string | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }
  const { initData, entry } = body as { initData?: string; entry?: IncomePayload | ExpensePayload };
  if (!initData) {
    return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  }
  if (!entry || typeof entry !== 'object') {
    return NextResponse.json({ error: 'missing_entry' }, { status: 400 });
  }

  const amount = Number(entry.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'bad_amount' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const tg = result.user;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', tg.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  }

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) {
    return NextResponse.json({ error: 'master_not_found' }, { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];

  if (entry.kind === 'income') {
    const { error } = await admin.from('manual_incomes').insert({
      master_id: master.id,
      amount,
      date: today,
      client_name: entry.client_name?.trim() || null,
      service_name: entry.service_name?.trim() || null,
      payment_method: entry.payment_method?.trim() || null,
      note: entry.note?.trim() || null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (entry.kind === 'expense') {
    const { error } = await admin.from('expenses').insert({
      master_id: master.id,
      profile_id: profile.id,
      amount,
      date: today,
      category: entry.category?.trim() || null,
      description: entry.description?.trim() || '',
      vendor: entry.vendor?.trim() || null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
}
