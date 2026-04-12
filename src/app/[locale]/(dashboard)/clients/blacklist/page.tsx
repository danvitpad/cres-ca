/** --- YAML
 * name: Client Blacklist
 * description: Lists clients with elevated cancellation_count or no_show_count for risk review.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  full_name: string;
  cancellation_count: number;
  no_show_count: number;
  total_visits: number;
  last_visit_at: string | null;
};

const CANCEL_THRESHOLD = 3;
const NOSHOW_THRESHOLD = 2;

export default function BlacklistPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, cancellation_count, no_show_count, total_visits, last_visit_at')
      .eq('master_id', master.id)
      .or(`cancellation_count.gte.${CANCEL_THRESHOLD},no_show_count.gte.${NOSHOW_THRESHOLD}`)
      .order('cancellation_count', { ascending: false });
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Чёрный список
        </h1>
        <p className="text-sm text-muted-foreground">
          Клиенты с {CANCEL_THRESHOLD}+ отменами или {NOSHOW_THRESHOLD}+ no-show. Стоит требовать предоплату.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Никто пока не в зоне риска — все клиенты надёжные.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Клиент</th>
                <th className="px-4 py-2 text-right">Отмен</th>
                <th className="px-4 py-2 text-right">No-show</th>
                <th className="px-4 py-2 text-right">Всего визитов</th>
                <th className="px-4 py-2 text-right">Последний визит</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${r.id}`} className="font-medium hover:underline">
                      {r.full_name}
                    </Link>
                  </td>
                  <td className={cn('px-4 py-3 text-right font-semibold', r.cancellation_count >= CANCEL_THRESHOLD && 'text-red-600')}>
                    {r.cancellation_count}
                  </td>
                  <td className={cn('px-4 py-3 text-right font-semibold', r.no_show_count >= NOSHOW_THRESHOLD && 'text-red-600')}>
                    {r.no_show_count}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{r.total_visits}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString() : '—'}
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
