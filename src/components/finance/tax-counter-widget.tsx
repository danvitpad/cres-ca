/** --- YAML
 * name: Tax Counter Widget
 * description: Live квартальный счётчик налога ФОП. Показывает «к уплате до Y: Z₴» + кол-во дней до дедлайна.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  masterId: string;
  taxRatePercent: number;
}

// ФОП квартальные дедлайны: за квартал нужно заплатить до 20 числа месяца, следующего за кварталом.
function currentQuarterRange(now: Date) {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3); // 0..3
  const start = new Date(y, q * 3, 1);
  const end = new Date(y, q * 3 + 3, 0, 23, 59, 59);
  // Дедлайн по закону: 20-е число месяца, следующего за кварталом.
  const deadline = new Date(y, q * 3 + 3, 20, 23, 59, 59);
  return { start, end, deadline, quarter: q + 1, year: y };
}

export function TaxCounterWidget({ masterId, taxRatePercent }: Props) {
  const [revenue, setRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!masterId) return;
    const supabase = createClient();
    const now = new Date();
    const { start, end } = currentQuarterRange(now);
    (async () => {
      const { data } = await supabase
        .from('appointments')
        .select('price, status')
        .eq('master_id', masterId)
        .in('status', ['completed', 'confirmed'])
        .gte('starts_at', start.toISOString())
        .lte('starts_at', end.toISOString());
      const total = ((data ?? []) as { price: number | null }[]).reduce((a, r) => a + Number(r.price ?? 0), 0);
      setRevenue(total);
      setLoading(false);
    })();
  }, [masterId]);

  const now = new Date();
  const { deadline, quarter, year } = currentQuarterRange(now);
  const taxDue = (revenue * taxRatePercent) / 100;
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const soon = daysLeft <= 14;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between',
        soon && 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/20',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            soon ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-primary/10 text-primary',
          )}
        >
          {soon ? <AlertTriangle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Квартал {quarter}/{year} · ставка {taxRatePercent}%
          </div>
          <div className="text-lg font-semibold">
            {loading ? '…' : `К уплате: ${taxDue.toFixed(0)} ₴`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className={cn('font-medium', soon && 'text-amber-700 dark:text-amber-400')}>
          до {deadline.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
          {daysLeft > 0 ? ` · осталось ${daysLeft} дн.` : ' · просрочено'}
        </span>
      </div>
    </div>
  );
}
