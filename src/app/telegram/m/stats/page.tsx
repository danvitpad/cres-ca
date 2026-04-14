/** --- YAML
 * name: MasterMiniAppStats
 * description: Master Mini App stats — week/month tabs with revenue, appointment count, avg check, top services bar chart, completion rate.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Target, Loader2, Award, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

type Period = 'week' | 'month';

interface AptRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  service_name: string;
}

export default function MasterMiniAppStats() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AptRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: m } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (!m) {
        setLoading(false);
        return;
      }
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - (period === 'week' ? 7 : 30));
      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, status, price, service:services(name)')
        .eq('master_id', m.id)
        .gte('starts_at', from.toISOString())
        .lte('starts_at', now.toISOString());
      type R = {
        id: string;
        starts_at: string;
        status: string;
        price: number | null;
        service: { name: string } | { name: string }[] | null;
      };
      const mapped: AptRow[] = ((data ?? []) as unknown as R[]).map((r) => {
        const svc = Array.isArray(r.service) ? r.service[0] : r.service;
        return {
          id: r.id,
          starts_at: r.starts_at,
          status: r.status,
          price: Number(r.price ?? 0),
          service_name: svc?.name ?? '—',
        };
      });
      setRows(mapped);
      setLoading(false);
    })();
  }, [userId, period]);

  const kpi = useMemo(() => {
    const active = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'cancelled_by_client' && r.status !== 'no_show');
    const completed = rows.filter((r) => r.status === 'completed');
    const noShow = rows.filter((r) => r.status === 'no_show').length;
    const revenue = completed.reduce((a, r) => a + r.price, 0);
    const avg = completed.length > 0 ? revenue / completed.length : 0;
    const completionRate = active.length > 0 ? Math.round((completed.length / active.length) * 100) : 0;
    return { total: active.length, completed: completed.length, revenue, avg, completionRate, noShow };
  }, [rows]);

  const topServices = useMemo(() => {
    const byService = new Map<string, { count: number; revenue: number }>();
    for (const r of rows) {
      if (r.status !== 'completed') continue;
      const existing = byService.get(r.service_name) ?? { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += r.price;
      byService.set(r.service_name, existing);
    }
    return Array.from(byService.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [rows]);

  const maxRevenue = Math.max(1, ...topServices.map((s) => s.revenue));

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-6 pb-10"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Аналитика</p>
        <h1 className="mt-1 text-2xl font-bold">Статистика</h1>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
        {(['week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              haptic('light');
              setPeriod(p);
            }}
            className={`flex-1 rounded-xl py-2 text-[12px] font-semibold transition-colors ${
              period === p ? 'bg-white text-black' : 'text-white/60'
            }`}
          >
            {p === 'week' ? '7 дней' : '30 дней'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={TrendingUp} label="Выручка" value={`${kpi.revenue.toFixed(0)}₴`} accent="emerald" />
            <StatCard icon={Calendar} label="Записей" value={kpi.total.toString()} accent="violet" />
            <StatCard icon={Target} label="Средний чек" value={`${kpi.avg.toFixed(0)}₴`} accent="amber" />
            <StatCard
              icon={Award}
              label="Выполнено"
              value={`${kpi.completionRate}%`}
              accent="sky"
              sub={`${kpi.completed} из ${kpi.total}`}
            />
          </div>

          {kpi.noShow > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
              <XCircle className="size-5 text-rose-300" />
              <div>
                <p className="text-[13px] font-semibold text-rose-200">{kpi.noShow} не пришло</p>
                <p className="text-[11px] text-rose-200/60">Попробуй требовать предоплату для новых клиентов</p>
              </div>
            </div>
          )}

          {/* Top services */}
          {topServices.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold">Топ-услуги</h2>
              <ul className="space-y-3">
                {topServices.map((s) => (
                  <li key={s.name}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="truncate font-semibold">{s.name}</span>
                      <span className="shrink-0 text-white/60">
                        {s.count}× · {s.revenue.toFixed(0)}₴
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-500"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-8 text-center">
              <p className="text-sm font-semibold">Ещё нет данных</p>
              <p className="mt-1 text-xs text-white/50">Начни принимать клиентов — статистика появится автоматически</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'violet' | 'emerald' | 'amber' | 'sky';
  sub?: string;
}) {
  const accents: Record<string, string> = {
    violet: 'from-violet-500/25 to-violet-500/5 text-violet-200',
    emerald: 'from-emerald-500/25 to-emerald-500/5 text-emerald-200',
    amber: 'from-amber-500/25 to-amber-500/5 text-amber-200',
    sky: 'from-sky-500/25 to-sky-500/5 text-sky-200',
  };
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accents[accent]} p-4`}>
      <Icon className="size-4 opacity-80" />
      <p className="mt-3 text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/40">{sub}</p>}
    </div>
  );
}
