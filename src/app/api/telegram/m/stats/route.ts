/** --- YAML
 * name: Telegram Master Stats API
 * description: Returns appointments for the last N days for the stats screen.
 * created: 2026-04-17
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
