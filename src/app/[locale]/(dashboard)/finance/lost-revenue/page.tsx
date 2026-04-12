/** --- YAML
 * name: Lost Revenue Analytics
 * description: Estimates revenue lost to cancellations, no-shows, and unconverted waitlist over the last 30 days.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingDown, AlertOctagon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';

type Bucket = {
  label: string;
  count: number;
  amount: number;
  hint: string;
};

export default function LostRevenuePage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [topCancellers, setTopCancellers] = useState<{ name: string; count: number }[]>([]);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [{ data: cancelled }, { data: noShows }, { data: waitlistRows }] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, price, client:clients(full_name)')
        .eq('master_id', master.id)
        .eq('status', 'cancelled')
        .gte('starts_at', since),
      supabase
        .from('appointments')
        .select('id, price')
        .eq('master_id', master.id)
        .eq('status', 'no_show')
        .gte('starts_at', since),
      supabase
        .from('waitlist')
        .select('id, service:services(price)')
        .eq('master_id', master.id)
        .gte('created_at', since),
    ]);

    const cancelledRows = ((cancelled ?? []) as unknown as {
      id: string;
      price: number;
      client: { full_name: string } | { full_name: string }[] | null;
    }[]).map((r) => ({
      id: r.id,
      price: r.price,
      client: Array.isArray(r.client) ? r.client[0] ?? null : r.client,
    }));
    const cancelledAmt = cancelledRows.reduce((a, r) => a + Number(r.price ?? 0), 0);
    const noShowAmt = (noShows ?? []).reduce((a: number, r: { price: number }) => a + Number(r.price ?? 0), 0);
    const waitlistAmt = ((waitlistRows ?? []) as unknown as { service: { price: number } | { price: number }[] | null }[])
      .reduce((a, r) => {
        const svc = Array.isArray(r.service) ? r.service[0] : r.service;
        return a + Number(svc?.price ?? 0);
      }, 0);

    setBuckets([
      { label: 'Отмены', count: cancelledRows.length, amount: cancelledAmt, hint: 'клиент отменил запись' },
      { label: 'No-show', count: (noShows ?? []).length, amount: noShowAmt, hint: 'клиент не пришёл' },
      { label: 'Лист ожидания', count: (waitlistRows ?? []).length, amount: waitlistAmt, hint: 'не смогли вписать' },
    ]);

    const counts = new Map<string, number>();
    for (const r of cancelledRows) {
      const name = r.client?.full_name ?? '—';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    setTopCancellers(
      Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    );

    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const total = buckets.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <TrendingDown className="h-6 w-6 text-red-500" />
          Упущенная выгода
        </h1>
        <p className="text-sm text-muted-foreground">За последние 30 дней. Что не было заработано.</p>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
        <div className="text-xs uppercase text-red-700 dark:text-red-300">Итого упущено</div>
        <div className="mt-1 text-3xl font-bold text-red-700 dark:text-red-300">{total.toFixed(2)}</div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {buckets.map((b) => (
              <div key={b.label} className="rounded-lg border bg-card p-4">
                <div className="text-xs text-muted-foreground">{b.label}</div>
                <div className="mt-1 text-2xl font-semibold">{b.amount.toFixed(2)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {b.count} • {b.hint}
                </div>
              </div>
            ))}
          </div>

          {topCancellers.length > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertOctagon className="h-4 w-4 text-amber-600" />
                Кто отменяет чаще
              </h2>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {topCancellers.map((c, i) => (
                      <tr key={i} className={cn('border-t', i === 0 && 'border-t-0')}>
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{c.count} отмен</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
