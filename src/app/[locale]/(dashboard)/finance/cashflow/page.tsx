/** --- YAML
 * name: Cash Flow Forecast
 * description: 14-дневный прогноз cash flow — ожидаемые поступления от подтверждённых визитов + активных подписок. Столбчатый график + таблица.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';

interface DayBucket {
  date: string;
  appointments: number;
  aptRevenue: number;
  subscriptions: number;
  total: number;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function CashflowForecastPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [buckets, setBuckets] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = addDays(today, 14);

    const empty: DayBucket[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      empty.push({ date: dateKey(d), appointments: 0, aptRevenue: 0, subscriptions: 0, total: 0 });
    }
    const byKey = new Map(empty.map((b) => [b.date, b]));

    const { data: apts } = await supabase
      .from('appointments')
      .select('starts_at, price, status')
      .eq('master_id', master.id)
      .in('status', ['confirmed', 'booked'])
      .gte('starts_at', today.toISOString())
      .lt('starts_at', horizon.toISOString());

    for (const a of (apts ?? []) as { starts_at: string; price: number | null; status: string }[]) {
      const key = a.starts_at.slice(0, 10);
      const b = byKey.get(key);
      if (!b) continue;
      b.appointments += 1;
      b.aptRevenue += Number(a.price ?? 0);
    }

    const { data: subs } = await supabase
      .from('client_subscriptions')
      .select('price, renewal_day, status')
      .eq('master_id', master.id)
      .eq('status', 'active');

    for (const s of (subs ?? []) as { price: number | null; renewal_day: number | null }[]) {
      if (!s.renewal_day || !s.price) continue;
      for (let i = 0; i < 14; i++) {
        const d = addDays(today, i);
        if (d.getDate() === s.renewal_day) {
          const b = byKey.get(dateKey(d));
          if (b) b.subscriptions += Number(s.price);
        }
      }
    }

    for (const b of byKey.values()) {
      b.total = b.aptRevenue + b.subscriptions;
    }

    setBuckets(Array.from(byKey.values()));
    setLoading(false);
  }, [master?.id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const sum = buckets.reduce((acc, b) => acc + b.total, 0);
    const visits = buckets.reduce((acc, b) => acc + b.appointments, 0);
    const maxDay = Math.max(0, ...buckets.map((b) => b.total));
    return { sum, visits, maxDay };
  }, [buckets]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <TrendingUp className="h-6 w-6 text-primary" />
          Cash flow · 14 дней
        </h1>
        <p className="text-sm text-muted-foreground">
          Прогноз по подтверждённым визитам и активным подпискам. Не учитывает расходы.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Всего к поступлению</div>
          <div className="text-xl font-semibold text-emerald-600">{totals.sum.toFixed(0)} ₴</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Ожидаемые визиты</div>
          <div className="text-xl font-semibold">{totals.visits}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Пиковый день</div>
          <div className="text-xl font-semibold">{totals.maxDay.toFixed(0)} ₴</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex h-40 items-end gap-1">
              {buckets.map((b) => {
                const h = totals.maxDay > 0 ? (b.total / totals.maxDay) * 100 : 0;
                return (
                  <div key={b.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${h}%`, minHeight: b.total > 0 ? 3 : 0 }}
                      title={`${b.date}: ${b.total.toFixed(0)}₴`}
                    />
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(b.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Дата</th>
                  <th className="px-4 py-2 text-right">Визиты</th>
                  <th className="px-4 py-2 text-right">От визитов</th>
                  <th className="px-4 py-2 text-right">Подписки</th>
                  <th className="px-4 py-2 text-right">Итого</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.date} className="border-t">
                    <td className="px-4 py-2">
                      {new Date(b.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{b.appointments || '—'}</td>
                    <td className="px-4 py-2 text-right">{b.aptRevenue ? b.aptRevenue.toFixed(0) : '—'}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{b.subscriptions ? b.subscriptions.toFixed(0) : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{b.total ? b.total.toFixed(0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
