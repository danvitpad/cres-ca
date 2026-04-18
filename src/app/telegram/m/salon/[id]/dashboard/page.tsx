/** --- YAML
 * name: Mini App Salon Dashboard
 * description: Salon-admin view in the Mini App. Team load cards, day metrics. Tap master → his schedule.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Users, Building2, ChevronRight } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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

interface DashboardData {
  salon: { id: string; name: string; logo_url: string | null; team_mode: 'unified' | 'marketplace' };
  metrics: {
    revenue_today: number;
    revenue_week: number;
    revenue_month: number;
    appointments_today: number;
    appointments_week: number;
    masters_count: number;
  };
  team: Array<{
    id: string;
    profile_id: string;
    display_name: string | null;
    avatar_url: string | null;
    specialization: string | null;
    appointments_today: number;
    revenue_today: number | null;
    load_percent: number;
  }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₴';
}

export default function MiniAppSalonDashboard() {
  const params = useParams();
  const router = useRouter();
  const salonId = params.id as string;
  const { ready } = useTelegram();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/telegram/m/salon/${salonId}/dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j: DashboardData) => {
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
  }, [ready, salonId]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {error === '403' ? 'Доступ только для владельца салона' : 'Не удалось загрузить дашборд'}
      </div>
    );
  }

  const isUnified = data.salon.team_mode === 'unified';

  return (
    <div className="p-4 pb-24 space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white">
          <Building2 className="size-5" />
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
            {isUnified ? 'Единый бизнес' : 'Коворкинг'}
          </div>
          <h1 className="text-lg font-bold">{data.salon.name}</h1>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        <MiniCard
          label="Сегодня"
          value={formatCurrency(data.metrics.revenue_today)}
          icon={TrendingUp}
        />
        <MiniCard
          label="Неделя"
          value={formatCurrency(data.metrics.revenue_week)}
          icon={TrendingUp}
        />
        <MiniCard label="Месяц" value={formatCurrency(data.metrics.revenue_month)} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniCard
          label="Записей сегодня"
          value={String(data.metrics.appointments_today)}
          icon={Calendar}
        />
        <MiniCard label="В команде" value={String(data.metrics.masters_count)} icon={Users} />
      </div>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Команда сегодня
        </h2>
        {data.team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
            Пока нет мастеров в команде
          </div>
        ) : (
          <div className="space-y-2">
            {data.team.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => router.push(`/telegram/m/salon/${salonId}/master/${m.id}`)}
                className="w-full rounded-xl border border-border bg-card p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="size-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    (m.display_name || 'M')[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.display_name || 'Мастер'}</div>
                  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        m.load_percent > 80
                          ? 'bg-rose-500'
                          : m.load_percent > 50
                            ? 'bg-emerald-500'
                            : 'bg-primary'
                      }`}
                      style={{ width: `${m.load_percent}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end">
                  <div className="text-xs font-semibold">{m.appointments_today}</div>
                  {isUnified && m.revenue_today !== null && (
                    <div className="text-[10px] text-muted-foreground">
                      {formatCurrency(m.revenue_today)}
                    </div>
                  )}
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-bold truncate">{value}</div>
    </div>
  );
}
