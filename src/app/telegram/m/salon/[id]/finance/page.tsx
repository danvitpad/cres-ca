/** --- YAML
 * name: Mini App Salon Finance Page
 * description: Admin-only. Period switcher (week/month/year), totals, per-master revenue & payout.
 *              Payout workflow (confirm/pay) lives on the web page.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TrendingUp, Receipt, Wallet, BarChart3 } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';

type Period = 'week' | 'month' | 'year';

interface MasterRow {
  master_id: string;
  display_name: string | null;
  avatar_url: string | null;
  revenue: number;
  net_payout: number;
}

interface FinanceData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  period: Period;
  totals: { revenue: number; expenses: number; payouts: number; profit: number };
  masters: MasterRow[];
}

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₴';
}

export default function MiniAppSalonFinancePage() {
  const params = useParams();
  const salonId = params.id as string;
  const { ready } = useTelegram();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    fetch(`/api/telegram/m/salon/${salonId}/finance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, period }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: FinanceData) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, salonId, period]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-full bg-white border-neutral-200 border border-neutral-200 w-fit">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              period === p ? 'bg-white text-black' : 'text-neutral-600'
            }`}
          >
            {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
        </div>
      ) : error || !data ? (
        <div className="text-sm text-neutral-600 text-center p-4">Ошибка загрузки</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <TotalCard label="Выручка" value={data.totals.revenue} icon={TrendingUp} tint="text-emerald-400" />
            <TotalCard label="Расходы" value={data.totals.expenses} icon={Receipt} tint="text-rose-400" />
            <TotalCard label="Выплаты" value={data.totals.payouts} icon={Wallet} tint="text-amber-400" />
            <TotalCard label="Прибыль" value={data.totals.profit} icon={BarChart3} tint="text-violet-400" />
          </div>

          <section>
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">По мастерам</h2>
            {data.masters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-400">
                Нет мастеров
              </div>
            ) : (
              <ul className="space-y-2">
                {data.masters.map((m) => (
                  <li key={m.master_id} className="rounded-xl border border-neutral-200 bg-white p-3 flex items-center gap-3">
                    <div className="size-9 rounded-full bg-white/10 text-neutral-900 font-bold flex items-center justify-center overflow-hidden shrink-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        (m.display_name || 'M')[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.display_name ?? 'Мастер'}</div>
                      <div className="text-[11px] text-neutral-500">Выручка: {formatCurrency(m.revenue)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">К выплате</div>
                      <div className="text-sm font-semibold">{formatCurrency(m.net_payout)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[11px] text-neutral-400 leading-relaxed text-center">
            Подтверждение и отметка выплат — на сайте в разделе «Финансы».
          </p>
        </>
      )}
    </div>
  );
}

function TotalCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: typeof TrendingUp;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${tint}`}>
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-bold truncate">{formatCurrency(value)}</div>
    </div>
  );
}
