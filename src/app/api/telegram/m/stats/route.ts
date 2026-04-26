/** --- YAML
 * name: Telegram Master Stats API
 * description: Returns appointments for the last N days for the stats screen.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const { initData, period } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ appointments: [] });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ appointments: [] });

  // 'today' — с начала сегодня (00:00); 'week' — 7 последних дней; 'month' — 30
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

  const [aptRes, manualRes] = await Promise.all([
    admin
      .from('appointments')
      .select('id, starts_at, status, price, service:services(name)')
      .eq('master_id', master.id)
      .gte('starts_at', from.toISOString())
      .lte('starts_at', now.toISOString()),
    admin
      .from('manual_incomes')
      .select('amount')
      .eq('master_id', master.id)
      .gte('date', from.toISOString().slice(0, 10))
      .lte('date', now.toISOString().slice(0, 10)),
  ]);

  const manualTotal = (manualRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );

  return NextResponse.json({
    appointments: aptRes.data ?? [],
    manual_income_total: manualTotal,
  });
}
