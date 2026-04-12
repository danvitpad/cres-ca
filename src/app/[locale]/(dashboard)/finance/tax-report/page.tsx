/** --- YAML
 * name: Tax Report
 * description: Monthly revenue/expenses/net-profit breakdown with tax estimate and CSV export (wraps /api/reports/monthly).
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MonthStat = {
  key: string;
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  inventoryCost: number;
  net: number;
  tax: number;
  afterTax: number;
};

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export default function TaxReportPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [months, setMonths] = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [taxRate, setTaxRate] = useState<number>(5);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const rate = master.tax_rate_percent ?? 5;
    setTaxRate(rate);

    const now = new Date();
    const ranges: { year: number; month: number; start: string; end: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      ranges.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }

    const stats: MonthStat[] = [];
    for (const r of ranges) {
      const [{ data: apts }, { data: exps }, { data: usage }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, payment:payments(amount)')
          .eq('master_id', master.id)
          .eq('status', 'completed')
          .gte('starts_at', r.start)
          .lte('starts_at', r.end),
        supabase
          .from('expenses')
          .select('amount')
          .eq('master_id', master.id)
          .gte('date', r.start.slice(0, 10))
          .lte('date', r.end.slice(0, 10)),
        supabase
          .from('inventory_usage')
          .select('quantity_used, item:inventory_items!inner(cost_per_unit, master_id)')
          .eq('item.master_id', master.id)
          .gte('recorded_at', r.start)
          .lte('recorded_at', r.end),
      ]);

      let revenue = 0;
      for (const a of (apts ?? []) as unknown as { payment: { amount: number } | { amount: number }[] | null }[]) {
        const p = a.payment;
        const amt = Array.isArray(p) ? (p[0]?.amount ?? 0) : (p?.amount ?? 0);
        revenue += Number(amt);
      }
      const expenses = (exps ?? []).reduce((a, e) => a + Number(e.amount ?? 0), 0);
      let inventoryCost = 0;
      for (const u of (usage ?? []) as unknown as { quantity_used: number; item: { cost_per_unit: number | null } | { cost_per_unit: number | null }[] | null }[]) {
        const item = Array.isArray(u.item) ? u.item[0] : u.item;
        inventoryCost += Number(u.quantity_used ?? 0) * Number(item?.cost_per_unit ?? 0);
      }
      const net = revenue - expenses - inventoryCost;
      const tax = net > 0 ? net * (rate / 100) : 0;
      stats.push({
        key: `${r.year}-${r.month}`,
        year: r.year,
        month: r.month,
        revenue,
        expenses,
        inventoryCost,
        net,
        tax,
        afterTax: net - tax,
      });
    }
    setMonths(stats);
    setLoading(false);
  }, [supabase, master?.id, master?.tax_rate_percent]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return months.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        expenses: acc.expenses + m.expenses,
        inventoryCost: acc.inventoryCost + m.inventoryCost,
        net: acc.net + m.net,
        tax: acc.tax + m.tax,
      }),
      { revenue: 0, expenses: 0, inventoryCost: 0, net: 0, tax: 0 },
    );
  }, [months]);

  function downloadCsv(year: number, month: number) {
    window.open(`/api/reports/monthly?year=${year}&month=${month}`, '_blank');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Receipt className="h-6 w-6 text-primary" />
          Налоговый отчёт
        </h1>
        <p className="text-sm text-muted-foreground">
          Ставка налога: {taxRate}% (меняется в настройках). Последние 6 месяцев.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Выручка" value={totals.revenue.toFixed(2)} />
        <Stat label="Расходы" value={totals.expenses.toFixed(2)} />
        <Stat label="Себестоимость" value={totals.inventoryCost.toFixed(2)} />
        <Stat label="Чистая прибыль" value={totals.net.toFixed(2)} accent={totals.net > 0} />
        <Stat label={`Налог ${taxRate}%`} value={totals.tax.toFixed(2)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Месяц</th>
                <th className="px-4 py-2 text-right">Выручка</th>
                <th className="px-4 py-2 text-right">Расходы</th>
                <th className="px-4 py-2 text-right">Себест.</th>
                <th className="px-4 py-2 text-right">Прибыль</th>
                <th className="px-4 py-2 text-right">Налог</th>
                <th className="px-4 py-2 text-right">После налога</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key} className="border-t">
                  <td className="px-4 py-3 font-medium">{MONTHS_RU[m.month - 1]} {m.year}</td>
                  <td className="px-4 py-3 text-right">{m.revenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{m.expenses.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{m.inventoryCost.toFixed(2)}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', m.net < 0 && 'text-red-600')}>{m.net.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{m.tax.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{m.afterTax.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => downloadCsv(m.year, m.month)}>
                      <Download className="mr-1 h-3 w-3" /> CSV
                    </Button>
                  </td>
                </tr>
              ))}
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
