/** --- YAML
 * name: Service Profitability Report
 * description: Real profit per service — material cost from inventory recipe vs revenue, sorted by margin.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';

type RecipeItem = { item_id: string; quantity: number };
type Service = { id: string; name: string; price: number | null; inventory_recipe: RecipeItem[] | null };
type InventoryItem = { id: string; name: string; cost_per_unit: number | null; unit: string | null };
type Row = {
  id: string;
  name: string;
  price: number;
  cost: number;
  profit: number;
  margin: number;
  lines: { name: string; quantity: number; unit: string; costPerUnit: number; subtotal: number }[];
};

export default function ProfitabilityReportPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);

    const { data: services } = await supabase
      .from('services')
      .select('id, name, price, inventory_recipe')
      .eq('master_id', master.id)
      .eq('is_active', true);

    const svcs = (services as Service[] | null) ?? [];

    const itemIds = new Set<string>();
    for (const s of svcs) for (const r of s.inventory_recipe ?? []) itemIds.add(r.item_id);

    const itemMap = new Map<string, InventoryItem>();
    if (itemIds.size > 0) {
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, cost_per_unit, unit')
        .in('id', Array.from(itemIds));
      for (const it of (items as InventoryItem[] | null) ?? []) itemMap.set(it.id, it);
    }

    const computed: Row[] = svcs.map((s) => {
      const recipe = s.inventory_recipe ?? [];
      const lines = recipe
        .map((r) => {
          const it = itemMap.get(r.item_id);
          if (!it) return null;
          const costPerUnit = Number(it.cost_per_unit ?? 0);
          return {
            name: it.name,
            quantity: r.quantity,
            unit: it.unit ?? '',
            costPerUnit,
            subtotal: r.quantity * costPerUnit,
          };
        })
        .filter(Boolean) as Row['lines'];
      const cost = lines.reduce((a, l) => a + l.subtotal, 0);
      const price = Number(s.price ?? 0);
      const profit = price - cost;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      return { id: s.id, name: s.name, price, cost, profit, margin, lines };
    });

    computed.sort((a, b) => b.margin - a.margin);
    setRows(computed);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const price = rows.reduce((a, r) => a + r.price, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { price, cost, profit, margin };
  }, [rows]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <TrendingUp className="h-6 w-6 text-primary" />
          Реальная прибыль по услугам
        </h1>
        <p className="text-sm text-muted-foreground">
          Себестоимость рассчитывается из техкарты услуги (inventory recipe) × стоимость единицы из склада.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Услуг" value={rows.length.toString()} />
        <Stat label="Выручка" value={totals.price.toFixed(2)} />
        <Stat label="Себестоимость" value={totals.cost.toFixed(2)} />
        <Stat label="Средняя маржа" value={`${totals.margin.toFixed(0)}%`} accent={totals.margin >= 60} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет активных услуг. Добавь услуги на /services.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Услуга</th>
                <th className="px-4 py-2 text-right">Цена</th>
                <th className="px-4 py-2 text-right">Себестоимость</th>
                <th className="px-4 py-2 text-right">Прибыль</th>
                <th className="px-4 py-2 text-right">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const marginColor =
                  r.margin >= 60
                    ? 'text-emerald-600'
                    : r.margin >= 30
                      ? 'text-amber-600'
                      : 'text-red-600';
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      {r.lines.length > 0 ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {r.lines.map((l, i) => (
                            <span key={i}>
                              {i > 0 ? ' · ' : ''}
                              {l.name} ({l.quantity} {l.unit})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted-foreground">Нет техкарты</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{r.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.cost.toFixed(2)}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold', r.profit < 0 && 'text-red-600')}>
                      {r.profit.toFixed(2)}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-bold', marginColor)}>
                      <span className="inline-flex items-center gap-1">
                        {r.margin < 30 && <AlertTriangle className="h-3 w-3" />}
                        {r.margin.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-semibold', accent && 'text-emerald-600')}>{value}</div>
    </div>
  );
}
