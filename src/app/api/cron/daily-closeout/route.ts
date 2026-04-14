/** --- YAML
 * name: Daily Closeout Cron
 * description: В конце дня формирует сводку по каждому мастеру (визиты, выручка, чаевые, расходы, отложить на налог) и отправляет в TG через notifications. Marker `[closeout:YYYY-MM-DD:master_id]`.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayStart = `${todayStr}T00:00:00`;
  const dayEnd = `${todayStr}T23:59:59`;

  const { data: masters } = await supabase
    .from('masters')
    .select('id, profile_id, tax_rate_percent, profile:profiles(full_name)');
  if (!masters) return NextResponse.json({ created: 0 });

  // Skip already-sent closeouts for today
  const { data: existing } = await supabase
    .from('notifications')
    .select('body')
    .like('body', `%[closeout:${todayStr}:%`);
  const sentMasters = new Set<string>();
  for (const n of existing ?? []) {
    const m = (n.body as string | null)?.match(/\[closeout:[\d-]+:([0-9a-f-]{36})\]/i);
    if (m) sentMasters.add(m[1]);
  }

  let created = 0;
  for (const m of masters) {
    const masterId = m.id as string;
    const profileId = m.profile_id as string | null;
    if (!profileId || sentMasters.has(masterId)) continue;

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, price, status, tip_amount')
      .eq('master_id', masterId)
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd);
    type A = { price: number | null; status: string; tip_amount: number | null };
    const active = ((appts ?? []) as unknown as A[]).filter(
      (a) => a.status !== 'cancelled_by_client' && a.status !== 'cancelled_by_master' && a.status !== 'no_show',
    );
    const revenue = active.reduce((acc, a) => acc + Number(a.price ?? 0), 0);
    const tips = active.reduce((acc, a) => acc + Number(a.tip_amount ?? 0), 0);

    const { data: exps } = await supabase
      .from('expenses')
      .select('amount')
      .eq('profile_id', profileId)
      .gte('date', todayStr)
      .lte('date', todayStr);
    const expenseTotal = ((exps ?? []) as { amount: number | null }[]).reduce((acc, e) => acc + Number(e.amount ?? 0), 0);

    if (active.length === 0 && expenseTotal === 0) continue;

    const taxRate = Number((m as { tax_rate_percent: number | null }).tax_rate_percent ?? 5);
    const taxDue = (revenue * taxRate) / 100;
    const net = revenue - expenseTotal - taxDue;

    const body =
      `📊 Итоги дня (${todayStr})\n\n` +
      `• Визитов: ${active.length}\n` +
      `• Выручка: ${revenue.toFixed(0)}₴${tips > 0 ? ` (из них чай: ${tips.toFixed(0)}₴)` : ''}\n` +
      (expenseTotal > 0 ? `• Расходы: ${expenseTotal.toFixed(0)}₴\n` : '') +
      `• Отложить на налог (${taxRate}%): ${taxDue.toFixed(0)}₴\n` +
      `• Чистыми: ${net.toFixed(0)}₴\n\n` +
      `[closeout:${todayStr}:${masterId}]`;

    await supabase.from('notifications').insert({
      profile_id: profileId,
      channel: 'telegram',
      title: '📊 Итоги дня',
      body,
      scheduled_for: now.toISOString(),
    });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}
