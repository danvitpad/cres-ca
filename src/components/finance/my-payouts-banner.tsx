/** --- YAML
 * name: MyPayoutsBanner
 * description: Banner-card shown on the solo master finance page when the master belongs to a salon.
 *              Shows latest payout status + expected amount. Hides itself when no payouts exist.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react';

interface Payout {
  id: string;
  salon_id: string;
  salon_name: string | null;
  team_mode: string | null;
  period_start: string;
  period_end: string;
  net_payout: number;
  status: 'draft' | 'confirmed' | 'paid';
  paid_at: string | null;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₴';
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

export function MyPayoutsBanner() {
  const [payouts, setPayouts] = useState<Payout[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/payouts')
      .then((r) => r.ok ? r.json() : { payouts: [] })
      .then((j: { payouts: Payout[] }) => { if (!cancelled) setPayouts(j.payouts); })
      .catch(() => { if (!cancelled) setPayouts([]); });
    return () => { cancelled = true; };
  }, []);

  if (!payouts || payouts.length === 0) return null;

  const latest = payouts[0];
  const Icon = latest.status === 'paid' ? CheckCircle2 : latest.status === 'confirmed' ? Clock3 : CircleDashed;
  const tint = latest.status === 'paid'
    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-400/40'
    : latest.status === 'confirmed'
      ? 'bg-indigo-500/10 text-indigo-600 border-indigo-400/40'
      : 'bg-amber-500/10 text-amber-700 border-amber-400/40';

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${tint}`}>
      <div className="size-10 rounded-full bg-white/70 dark:bg-black/20 flex items-center justify-center shrink-0">
        <Wallet className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider opacity-70">
          {latest.salon_name ?? 'Салон'} · {formatMonth(latest.period_start)}
        </div>
        <div className="text-base font-semibold flex items-center gap-1.5 mt-0.5">
          <Icon className="size-4" />
          {latest.status === 'paid'
            ? `Выплачено: ${formatCurrency(latest.net_payout)}`
            : latest.status === 'confirmed'
              ? `Ожидается выплата: ${formatCurrency(latest.net_payout)}`
              : `В расчёте: ${formatCurrency(latest.net_payout)}`}
        </div>
      </div>
    </div>
  );
}
