/** --- YAML
 * name: Low Stock Alerts Cron
 * description: Ежедневная проверка inventory. Если quantity <= low_stock_threshold — шлёт TG-пуш мастеру. Marker `[lowstock:YYYY-MM-DD:master_id]`.
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
  const today = new Date().toISOString().slice(0, 10);

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, quantity, unit, low_stock_threshold, master_id, master:masters(profile_id)')
    .not('low_stock_threshold', 'is', null);

  type Row = {
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    low_stock_threshold: number | null;
    master_id: string;
    master: { profile_id: string | null } | { profile_id: string | null }[] | null;
  };

  const byMaster = new Map<string, { profileId: string; low: { name: string; qty: number; thr: number; unit: string }[] }>();
  for (const row of ((items ?? []) as unknown as Row[])) {
    const qty = Number(row.quantity ?? 0);
    const thr = Number(row.low_stock_threshold ?? 0);
    if (thr <= 0 || qty > thr) continue;
    const master = Array.isArray(row.master) ? row.master[0] : row.master;
    const profileId = master?.profile_id;
    if (!profileId) continue;
    const bucket = byMaster.get(row.master_id) ?? { profileId, low: [] };
    bucket.low.push({ name: row.name, qty, thr, unit: row.unit ?? 'шт' });
    byMaster.set(row.master_id, bucket);
  }

  if (byMaster.size === 0) return NextResponse.json({ ok: true, created: 0 });

  const { data: existing } = await supabase
    .from('notifications')
    .select('body')
    .like('body', `%[lowstock:${today}:%`);
  const sent = new Set<string>();
  for (const n of existing ?? []) {
    const m = (n.body as string | null)?.match(/\[lowstock:[\d-]+:([0-9a-f-]{36})\]/i);
    if (m) sent.add(m[1]);
  }

  let created = 0;
  for (const [masterId, bucket] of byMaster) {
    if (sent.has(masterId)) continue;
    const lines = bucket.low.map((i) => `• ${i.name}: ${i.qty} ${i.unit} (порог ${i.thr})`).join('\n');
    await supabase.from('notifications').insert({
      profile_id: bucket.profileId,
      channel: 'telegram',
      title: '📦 Мало на складе',
      body: `Заканчивается:\n\n${lines}\n\n[lowstock:${today}:${masterId}]`,
      scheduled_for: new Date().toISOString(),
    });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}
