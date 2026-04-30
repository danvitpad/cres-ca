/** --- YAML
 * name: Inventory Forecast Cron
 * description: Daily 09:00 Kyiv. Per master:
 *              1. Calls compute_inventory_forecast() — items with days_until_empty ≤ 14
 *                 OR below static low_stock_threshold = "critical".
 *              2. Groups critical items by preferred_supplier_id.
 *              3. Creates draft supplier_orders for each supplier (one row, items in jsonb).
 *              4. Sends a SINGLE morning summary notification listing supplier groups.
 *              Master can open the dashboard, review the drafts, and send.
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface ForecastRow {
  item_id: string;
  item_name: string;
  current_qty: number;
  unit: string | null;
  avg_daily_out: number;
  days_until_empty: number | null;
  is_critical: boolean;
  preferred_supplier_id: string | null;
  cost_per_unit: number | null;
}

export async function GET() {
  const supabase = admin();

  // Active masters
  const { data: masters, error: mErr } = await supabase
    .from('masters')
    .select('id, profile_id, display_name')
    .eq('is_active', true);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  let totalSummariesSent = 0;
  let totalDraftsCreated = 0;

  for (const m of (masters ?? []) as Array<{ id: string; profile_id: string | null; display_name: string | null }>) {
    if (!m.profile_id) continue;

    // 1. Compute forecast
    const { data: rows, error: fcErr } = await supabase.rpc('compute_inventory_forecast', { p_master_id: m.id });
    if (fcErr || !rows) continue;

    const critical = (rows as ForecastRow[]).filter((r) => r.is_critical);
    if (critical.length === 0) continue;

    // 2. Group by supplier
    const bySupplier = new Map<string | null, ForecastRow[]>();
    for (const item of critical) {
      const key = item.preferred_supplier_id ?? null;
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key)!.push(item);
    }

    // 3. Load supplier names
    const supplierIds = Array.from(bySupplier.keys()).filter((x): x is string => !!x);
    const { data: suppliers } = supplierIds.length
      ? await supabase.from('suppliers').select('id, name').in('id', supplierIds)
      : { data: [] };
    const supplierNameById = new Map<string, string>(
      (suppliers ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );

    // 4. Create draft supplier_orders for each supplier (skip "no supplier" group)
    const supplierLines: string[] = [];
    let draftsCreatedForThisMaster = 0;
    for (const [supplierId, items] of bySupplier.entries()) {
      const supplierName = supplierId ? (supplierNameById.get(supplierId) ?? 'Без поставщика') : 'Без поставщика';

      // Skip creating a draft if no supplier ID (master can't send anywhere)
      if (supplierId) {
        // Avoid creating duplicate drafts within last 24h
        const { data: existingDraft } = await supabase
          .from('supplier_orders')
          .select('id')
          .eq('master_id', m.id)
          .eq('supplier_id', supplierId)
          .eq('status', 'draft')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingDraft) {
          const itemsJson = items.map((it) => ({
            item_id: it.item_id,
            name: it.item_name,
            unit: it.unit,
            current_qty: it.current_qty,
            avg_daily: it.avg_daily_out,
            days_left: it.days_until_empty,
            // Suggest ordering ~30 days worth (or current_qty * 2 if no usage data)
            suggested_qty: it.avg_daily_out > 0
              ? Math.ceil(it.avg_daily_out * 30)
              : Math.max(1, Math.ceil(it.current_qty * 2)),
            cost_per_unit: it.cost_per_unit,
          }));
          const totalCost = itemsJson.reduce(
            (sum, x) => sum + (x.suggested_qty * (x.cost_per_unit ?? 0)),
            0,
          );

          await supabase.from('supplier_orders').insert({
            master_id: m.id,
            supplier_id: supplierId,
            status: 'draft',
            items: itemsJson,
            total_cost: totalCost,
            currency: 'UAH',
            note: 'Авто-черновик: позиции на исходе',
          });
          draftsCreatedForThisMaster++;
        }
      }

      // 5. Build line for summary
      supplierLines.push(`• ${supplierName}: ${items.length} ${items.length === 1 ? 'позиция' : 'позиции'}`);
    }

    if (draftsCreatedForThisMaster === 0 && supplierLines.length === 0) continue;

    // 6. Single morning summary notification (dedup: skip if sent today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('profile_id', m.profile_id)
      .filter('data->>kind', 'eq', 'inventory_morning_summary')
      .gte('created_at', todayStart.toISOString())
      .maybeSingle();
    if (existingNotif) continue;

    const title = critical.length === 1
      ? '⚠️ Закончится материал'
      : `⚠️ ${critical.length} ${critical.length < 5 ? 'позиции' : 'позиций'} на исходе`;

    const body = supplierLines.join('\n')
      + (draftsCreatedForThisMaster > 0
        ? `\n\nЯ подготовил ${draftsCreatedForThisMaster} ${draftsCreatedForThisMaster === 1 ? 'черновик заказа' : 'черновиков заказов'}. Открой и отправь.`
        : '\n\nДобавь поставщиков, чтобы я подготавливал черновики автоматически.');

    await supabase.from('notifications').insert({
      profile_id: m.profile_id,
      channel: 'telegram',
      title,
      body,
      data: { kind: 'inventory_morning_summary', critical_count: critical.length, drafts: draftsCreatedForThisMaster },
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    });

    totalSummariesSent++;
    totalDraftsCreated += draftsCreatedForThisMaster;
  }

  return NextResponse.json({
    ok: true,
    summaries_sent: totalSummariesSent,
    drafts_created: totalDraftsCreated,
  });
}
