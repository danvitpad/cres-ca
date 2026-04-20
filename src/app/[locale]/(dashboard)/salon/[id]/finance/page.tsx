/** --- YAML
 * name: Salon Finance
 * description: Admin-only salon finance dashboard. Period selector (week/month/year),
 *              totals (revenue, expenses, payouts, profit), per-master breakdown with commission +
 *              rent amounts, payout status. Actions: generate drafts, confirm, mark paid.
 * created: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendingUp, Wallet, Receipt, PieChart, Building2, CheckCircle2, CircleDashed, Banknote } from 'lucide-react';
import { toast } from 'sonner';

type Period = 'week' | 'month' | 'year';

interface Payout {
  id: string;
  status: 'draft' | 'confirmed' | 'paid';
  net_payout: number;
  period_start: string;
  period_end: string;
}

interface MasterRow {
  id: string;
  display_name: string | null;
  revenue: number;
  commission_percent: number;
  commission_amount: number;
  rent_amount: number;
  net_payout: number;
  payout: Payout | null;
}

interface FinanceData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  role: 'admin';
  period: { from: string; to: string; key: Period };
  totals: { revenue: number; expenses: number; payouts: number; profit: number };
  per_master: MasterRow[];
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₴';
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'year', label: 'Год' },
];

export default function SalonFinancePage() {
  const params = useParams();
  const salonId = params.id as string;

  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/salon/${salonId}/finance?period=${period}`)
      .then(async (r) => {
        if (r.status === 403) throw new Error('forbidden');
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then((j: FinanceData) => setData(j))
      .catch((e) => setError(e instanceof Error ? e.message : 'error'))
      .finally(() => setLoading(false));
  }, [salonId, period]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerate() {
    setBusyId('generate');
    const res = await fetch(`/api/salon/${salonId}/payouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setBusyId(null);
    if (!res.ok) { toast.error('Не удалось сформировать выплаты'); return; }
    const j = await res.json();
    toast.success(`Создано: ${j.created}, обновлено: ${j.updated}`);
    load();
  }

  async function setPayoutStatus(p: Payout, status: 'confirmed' | 'paid') {
    setBusyId(p.id);
    const res = await fetch(`/api/salon/${salonId}/payouts/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) { toast.error('Не удалось обновить статус'); return; }
    toast.success(status === 'confirmed' ? 'Подтверждено' : 'Отмечено выплаченным');
    load();
  }

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <Wallet className="size-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Доступ только для владельца</h2>
        <p className="text-sm text-muted-foreground mt-2">Финансы салона видны администратору.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-muted-foreground">Не удалось загрузить</div>;
  }

  const isUnified = data.salon.team_mode === 'unified';

  return (
    <div className="p-4 md:p-6 space-y-6 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3 justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-300">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Финансы · {isUnified ? 'Единый бизнес' : 'Коворкинг'}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{data.salon.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                period === p.key ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TotalCard
          title="Выручка"
          value={formatCurrency(data.totals.revenue)}
          icon={TrendingUp}
          tint="emerald"
        />
        <TotalCard
          title="Расходы"
          value={formatCurrency(data.totals.expenses)}
          icon={Receipt}
          tint="rose"
        />
        <TotalCard
          title="Выплаты мастерам"
          value={formatCurrency(data.totals.payouts)}
          icon={Banknote}
          tint="amber"
        />
        <TotalCard
          title="Прибыль"
          value={formatCurrency(data.totals.profit)}
          icon={PieChart}
          tint="violet"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            По мастерам
          </h2>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busyId === 'generate'}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {busyId === 'generate' ? 'Считаю…' : 'Сформировать выплаты'}
          </button>
        </div>

        {data.per_master.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            В команде пока нет мастеров
          </div>
        ) : (
          <div className="space-y-2">
            {data.per_master.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                    {(m.display_name || 'M')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.display_name || 'Мастер'}</div>
                    <div className="text-xs text-muted-foreground">
                      Выручка: <strong className="text-foreground">{formatCurrency(m.revenue)}</strong>
                      {isUnified ? (
                        <> · Комиссия: <strong className="text-foreground">{m.commission_percent}%</strong></>
                      ) : (
                        <>
                          {m.commission_percent > 0 && (
                            <> · Комиссия владельцу: <strong className="text-foreground">{m.commission_percent}%</strong></>
                          )}
                          {m.rent_amount > 0 && (
                            <> · Аренда: <strong className="text-foreground">{formatCurrency(m.rent_amount)}</strong></>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatCurrency(m.net_payout)}</div>
                    <PayoutBadge payout={m.payout} />
                  </div>
                </div>
                {m.payout && m.payout.status !== 'paid' && (
                  <div className="mt-3 flex gap-2">
                    {m.payout.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => setPayoutStatus(m.payout!, 'confirmed')}
                        disabled={busyId === m.payout.id}
                        className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Подтвердить
                      </button>
                    )}
                    {m.payout.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => setPayoutStatus(m.payout!, 'paid')}
                        disabled={busyId === m.payout.id}
                        className="h-8 px-3 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Отметить выплаченным
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PayoutBadge({ payout }: { payout: Payout | null }) {
  if (!payout) {
    return (
      <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
        <CircleDashed className="size-3" /> не сформировано
      </span>
    );
  }
  if (payout.status === 'paid') {
    return (
      <span className="text-[10px] text-emerald-600 inline-flex items-center gap-0.5">
        <CheckCircle2 className="size-3" /> выплачено
      </span>
    );
  }
  if (payout.status === 'confirmed') {
    return (
      <span className="text-[10px] text-indigo-600 inline-flex items-center gap-0.5">
        <CheckCircle2 className="size-3" /> подтверждено
      </span>
    );
  }
  return (
    <span className="text-[10px] text-amber-600 inline-flex items-center gap-0.5">
      <CircleDashed className="size-3" /> черновик
    </span>
  );
}

function TotalCard({
  title, value, icon: Icon, tint,
}: {
  title: string;
  value: string;
  icon: typeof TrendingUp;
  tint: 'emerald' | 'rose' | 'amber' | 'violet';
}) {
  const tints: Record<typeof tint, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
    >
      <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${tints[tint]}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-lg font-semibold truncate">{value}</div>
      </div>
    </motion.div>
  );
}
