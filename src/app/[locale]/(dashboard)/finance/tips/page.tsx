/** --- YAML
 * name: Tips Quick Log
 * description: Быстрый лог чаевых за день/неделю. Список completed визитов с inline-инпутом tip_amount.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { HandCoins, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Row {
  id: string;
  starts_at: string;
  price: number | null;
  tip_amount: number | null;
  currency: string | null;
  client: { full_name: string | null } | null;
  service: { name: string | null } | null;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function TipsLogPage() {
  const supabase = createClient();
  const { master } = useMaster();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [range, setRange] = useState<'today' | 'week'>('today');

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const now = new Date();
    const start = range === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : addDays(now, -7);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const { data } = await supabase
      .from('appointments')
      .select('id, starts_at, price, tip_amount, currency, client:clients(full_name), service:services(name)')
      .eq('master_id', master.id)
      .eq('status', 'completed')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at', { ascending: false });
    setRows(((data ?? []) as unknown as Row[]));
    const d: Record<string, string> = {};
    for (const r of (data ?? []) as unknown as Row[]) {
      d[r.id] = r.tip_amount ? String(r.tip_amount) : '';
    }
    setDrafts(d);
    setLoading(false);
  }, [master?.id, supabase, range]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(id: string) {
    const val = Number(drafts[id] ?? 0);
    const { error } = await supabase.from('appointments').update({ tip_amount: val || null }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Чай записан');
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, tip_amount: val || null } : r)));
  }

  const totalTips = rows.reduce((acc, r) => acc + Number(r.tip_amount ?? 0), 0);
  const totalRevenue = rows.reduce((acc, r) => acc + Number(r.price ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <HandCoins className="h-6 w-6 text-primary" />
          Чаевые
        </h1>
        <p className="text-sm text-muted-foreground">
          Логируй чай сразу — отдельно от выручки, попадёт в P&L отдельной строкой.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {(['today', 'week'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={`rounded-full px-4 py-1.5 text-sm ${range === k ? 'bg-primary text-primary-foreground' : 'border'}`}
          >
            {k === 'today' ? 'Сегодня' : '7 дней'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Выручка</div>
          <div className="text-lg font-semibold">{totalRevenue.toFixed(0)} ₴</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Чаевые</div>
          <div className="text-lg font-semibold text-emerald-600">{totalTips.toFixed(0)} ₴</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Визитов</div>
          <div className="text-lg font-semibold">{rows.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Нет завершённых визитов за выбранный период.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.client?.full_name ?? '—'}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.service?.name ?? '—'} · {new Date(r.starts_at).toLocaleDateString('ru-RU')} ·{' '}
                  {Number(r.price ?? 0).toFixed(0)} {r.currency ?? 'UAH'}
                </div>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={drafts[r.id] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="₴"
                className="w-24"
              />
              <Button size="sm" variant="outline" onClick={() => save(r.id)}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
