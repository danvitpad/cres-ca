/** --- YAML
 * name: Debts Reminder Cron
 * description: Раз в неделю напоминает мастерам клиентам которые должны за прошлые визиты. Marker `[debt:week:master_id]`.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const weekTag = new Date().toISOString().slice(0, 10);

  const { data: masters } = await supabase.from('masters').select('id, profile_id');
  if (!masters) return NextResponse.json({ ok: true, created: 0 });

  const { data: existing } = await supabase
    .from('notifications')
    .select('body')
    .like('body', `%[debt:${weekTag.slice(0, 7)}:%`);
  const sent = new Set<string>();
  for (const n of existing ?? []) {
    const m = (n.body as string | null)?.match(/\[debt:[\d-]+:([0-9a-f-]{36})\]/i);
    if (m) sent.add(m[1]);
  }

  let created = 0;
  for (const m of masters) {
    const masterId = m.id as string;
    const profileId = m.profile_id as string | null;
    if (!profileId || sent.has(masterId)) continue;

    const { data: apts } = await supabase
      .from('appointments')
      .select('id, price, client:clients(id, full_name), payments(amount, status, type)')
      .eq('master_id', masterId)
      .eq('status', 'completed')
      .gte('starts_at', new Date(Date.now() - 90 * 86400 * 1000).toISOString());

    type Row = {
      id: string;
      price: number | null;
      client: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
      payments: { amount: number | null; status: string; type: string }[] | null;
    };

    const debtByClient = new Map<string, { name: string; debt: number }>();
    for (const a of ((apts ?? []) as unknown as Row[])) {
      const paid = (a.payments ?? [])
        .filter((p) => p.status === 'success' && p.type !== 'refund')
        .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
      const owed = Number(a.price ?? 0) - paid;
      if (owed <= 0.01) continue;
      const cli = Array.isArray(a.client) ? a.client[0] : a.client;
      if (!cli?.id) continue;
      const cur = debtByClient.get(cli.id) ?? { name: cli.full_name ?? 'Клиент', debt: 0 };
      cur.debt += owed;
      debtByClient.set(cli.id, cur);
    }

    if (debtByClient.size === 0) continue;

    const lines = Array.from(debtByClient.values())
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10)
      .map((d) => `• ${d.name} — ${d.debt.toFixed(0)}₴`);
    const total = Array.from(debtByClient.values()).reduce((a, d) => a + d.debt, 0);

    const body =
      `💸 Должники этой недели\n\n` +
      `Всего клиентов с долгами: ${debtByClient.size}\n` +
      `Общая сумма: ${total.toFixed(0)}₴\n\n` +
      lines.join('\n') +
      `\n\n[debt:${weekTag.slice(0, 7)}:${masterId}]`;

    await supabase.from('notifications').insert({
      profile_id: profileId,
      channel: 'telegram',
      title: '💸 Должники',
      body,
      scheduled_for: new Date().toISOString(),
    });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}
