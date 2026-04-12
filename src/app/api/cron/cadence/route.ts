/** --- YAML
 * name: Cadence Reminder Cron
 * description: Computes median visit interval per client and notifies overdue ones (once per day via dedup marker).
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, profile_id, master_id')
    .not('profile_id', 'is', null);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 });
  }

  const clientIds = clients.map((c) => c.id);
  const { data: apts } = await supabase
    .from('appointments')
    .select('client_id, starts_at')
    .in('client_id', clientIds)
    .eq('status', 'completed')
    .order('starts_at', { ascending: true });

  const byClient = new Map<string, Date[]>();
  for (const a of (apts ?? []) as { client_id: string; starts_at: string }[]) {
    const arr = byClient.get(a.client_id) ?? [];
    arr.push(new Date(a.starts_at));
    byClient.set(a.client_id, arr);
  }

  const now = Date.now();
  const notifyRows: Array<{
    profile_id: string;
    channel: string;
    title: string;
    body: string;
    scheduled_for: string;
  }> = [];

  for (const c of clients) {
    const dates = byClient.get(c.id) ?? [];
    if (dates.length < 2) continue;
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
    }
    const med = Math.round(median(intervals));
    const daysSinceLast = (now - dates[dates.length - 1].getTime()) / 86400000;
    const overdueBy = Math.round(daysSinceLast - med);
    if (overdueBy <= 0) continue;

    const marker = `[cadence:${c.id}:${today}]`;
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('profile_id', c.profile_id!)
      .like('body', `%${marker}%`)
      .limit(1);
    if (existing && existing.length > 0) continue;

    notifyRows.push({
      profile_id: c.profile_id!,
      channel: 'telegram',
      title: '⏰ Пора записаться',
      body: `${c.full_name}, обычно ты приходишь раз в ~${med} дней. Прошло уже ${Math.round(daysSinceLast)}. ${marker}`,
      scheduled_for: new Date().toISOString(),
    });
  }

  if (notifyRows.length > 0) {
    await supabase.from('notifications').insert(notifyRows);
  }

  return NextResponse.json({ ok: true, checked: clients.length, notified: notifyRows.length });
}
