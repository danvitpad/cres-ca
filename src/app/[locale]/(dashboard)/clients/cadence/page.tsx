/** --- YAML
 * name: Visit Cadence Analyzer
 * description: Computes median interval between visits per client and flags overdue ones with one-click reminder.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Clock3, BellRing } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AppointmentRow = {
  client_id: string;
  starts_at: string;
};
type ClientLite = {
  id: string;
  full_name: string;
  profile_id: string | null;
};
type Row = {
  id: string;
  full_name: string;
  profile_id: string | null;
  visits: number;
  median: number;
  daysSinceLast: number;
  overdueBy: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function CadencePage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);

    const [{ data: clients }, { data: apts }] = await Promise.all([
      supabase
        .from('clients')
        .select('id, full_name, profile_id')
        .eq('master_id', master.id),
      supabase
        .from('appointments')
        .select('client_id, starts_at')
        .eq('master_id', master.id)
        .eq('status', 'completed')
        .order('starts_at', { ascending: true }),
    ]);

    const byClient = new Map<string, Date[]>();
    for (const a of (apts ?? []) as AppointmentRow[]) {
      const arr = byClient.get(a.client_id) ?? [];
      arr.push(new Date(a.starts_at));
      byClient.set(a.client_id, arr);
    }

    const today = Date.now();
    const result: Row[] = ((clients ?? []) as ClientLite[])
      .map((c) => {
        const dates = byClient.get(c.id) ?? [];
        if (dates.length < 2) return null;
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
        }
        const med = median(intervals);
        const daysSinceLast = (today - dates[dates.length - 1].getTime()) / 86400000;
        return {
          id: c.id,
          full_name: c.full_name,
          profile_id: c.profile_id,
          visits: dates.length,
          median: Math.round(med),
          daysSinceLast: Math.round(daysSinceLast),
          overdueBy: Math.round(daysSinceLast - med),
        };
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => b.overdueBy - a.overdueBy);

    setRows(result);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const overdue = useMemo(() => rows.filter((r) => r.overdueBy > 0), [rows]);

  async function nudge(row: Row) {
    if (!row.profile_id) {
      toast.error('У клиента нет профиля для уведомления');
      return;
    }
    const { error } = await supabase.from('notifications').insert({
      profile_id: row.profile_id,
      channel: 'telegram',
      title: '⏰ Пора записаться',
      body: `${row.full_name}, обычно ты приходишь раз в ~${row.median} дней. Прошло уже ${row.daysSinceLast}. [cadence:${row.id}]`,
      scheduled_for: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Напоминание отправлено');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Clock3 className="h-6 w-6 text-primary" />
          Периодичность визитов
        </h1>
        <p className="text-sm text-muted-foreground">
          Медианный интервал между визитами. Просроченные — приоритет на напоминание.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Постоянных" value={rows.length.toString()} />
        <Stat label="Просрочено" value={overdue.length.toString()} accent={overdue.length > 0} />
        <Stat
          label="Сред. интервал"
          value={rows.length > 0 ? `${Math.round(rows.reduce((a, r) => a + r.median, 0) / rows.length)} дн` : '—'}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет клиентов с 2+ визитами — анализ невозможен.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Клиент</th>
                <th className="px-4 py-2 text-right">Визитов</th>
                <th className="px-4 py-2 text-right">Раз в</th>
                <th className="px-4 py-2 text-right">Прошло</th>
                <th className="px-4 py-2 text-right">Статус</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOverdue = r.overdueBy > 0;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${r.id}`} className="font-medium hover:underline">
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.visits}</td>
                    <td className="px-4 py-3 text-right">{r.median} дн</td>
                    <td className="px-4 py-3 text-right">{r.daysSinceLast} дн</td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-semibold',
                        isOverdue ? 'text-red-600' : 'text-emerald-600',
                      )}
                    >
                      {isOverdue ? `+${r.overdueBy} дн` : 'в графике'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOverdue && (
                        <Button size="sm" variant="outline" onClick={() => nudge(r)}>
                          <BellRing className="mr-1 h-3 w-3" /> Напомнить
                        </Button>
                      )}
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
      <div className={cn('text-lg font-semibold', accent && 'text-red-600')}>{value}</div>
    </div>
  );
}
