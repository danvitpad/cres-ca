/** --- YAML
 * name: Salon Owner Dashboard
 * description: Admin-only dashboard for a salon. Shows team load, revenue metrics (today/week/month),
 *              alerts. Unified shows per-master revenue, marketplace hides it.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
  Building2,
  Crown,
  ArrowRight,
} from 'lucide-react';

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
  alerts: Array<{ kind: string; message: string }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₴';
}

export default function SalonDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const salonId = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/salon/${salonId}/dashboard`)
      .then(async (r) => {
        if (r.status === 403) throw new Error('forbidden');
        if (!r.ok) throw new Error('failed');
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
  }, [salonId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <Crown className="size-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Доступ только для владельца</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Этот дашборд доступен владельцу салона и администраторам.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Не удалось загрузить данные
      </div>
    );
  }

  const isUnified = data.salon.team_mode === 'unified';

  if (isMobileView) {
    const ACCENT = '#2563eb';
    const avgLoad = data.team.length > 0
      ? Math.round(data.team.reduce((s, m) => s + m.load_percent, 0) / data.team.length)
      : 0;

    return (
      <div style={{ minHeight: '100dvh', background: '#f8fafc', padding: '16px 16px 120px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isUnified ? 'Єдиний бізнес' : 'Коворкінг'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{data.salon.name}</div>
          </div>
          <button type="button" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <Building2 style={{ width: 16, height: 16, color: '#64748b' }} />
          </button>
        </div>

        {/* 2x2 KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Дохід сьогодні', value: formatCurrency(data.metrics.revenue_today), color: '#10b981' },
            { label: 'Записів сьогодні', value: String(data.metrics.appointments_today), color: ACCENT },
            { label: 'Зайнятість', value: `${avgLoad}%`, color: avgLoad > 80 ? '#f43f5e' : avgLoad > 50 ? '#10b981' : '#f59e0b' },
            { label: 'Майстрів', value: String(data.metrics.masters_count), color: '#8b5cf6' },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Weekly revenue */}
        <div style={{ background: `${ACCENT}10`, borderRadius: 16, padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Дохід за тиждень</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>{formatCurrency(data.metrics.revenue_week)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>За місяць</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{formatCurrency(data.metrics.revenue_month)}</div>
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {data.alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a', marginBottom: 8 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: '#d97706', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#92400e' }}>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Team section */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Команда сьогодні</span>
          <button type="button" onClick={() => router.push(`/settings/team`)} style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
            Управляти <ArrowRight style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {data.team.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 13 }}>
            Поки немає майстрів у команді
          </div>
        ) : (
          data.team.map((m) => (
            <div key={m.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 10, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (m.display_name || 'M')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name || 'Майстер'}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{m.specialization || 'Без спеціалізації'}</div>
                <div style={{ marginTop: 6, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.load_percent}%`, background: m.load_percent > 80 ? '#f43f5e' : m.load_percent > 50 ? '#10b981' : ACCENT, borderRadius: 2, transition: 'width 0.6s' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{m.appointments_today}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.load_percent}%</div>
                {isUnified && m.revenue_today !== null && (
                  <div style={{ fontSize: 11, color: '#64748b' }}>{formatCurrency(m.revenue_today)}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="size-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-300">
          <Building2 className="size-6" />
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground tracking-wider">
            {isUnified ? 'Единый бизнес' : 'Коворкинг мастеров'}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{data.salon.name}</h1>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard
          title="Выручка сегодня"
          value={formatCurrency(data.metrics.revenue_today)}
          icon={TrendingUp}
          tint="emerald"
        />
        <MetricCard
          title="Выручка за неделю"
          value={formatCurrency(data.metrics.revenue_week)}
          icon={TrendingUp}
          tint="indigo"
        />
        <MetricCard
          title="Выручка за месяц"
          value={formatCurrency(data.metrics.revenue_month)}
          icon={TrendingUp}
          tint="violet"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          title="Записей сегодня"
          value={String(data.metrics.appointments_today)}
          icon={Calendar}
          tint="amber"
        />
        <MetricCard
          title="Записей за неделю"
          value={String(data.metrics.appointments_week)}
          icon={Calendar}
          tint="sky"
        />
        <MetricCard
          title="Мастеров в команде"
          value={String(data.metrics.masters_count)}
          icon={Users}
          tint="rose"
        />
      </div>

      {data.alerts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <AlertTriangle className="size-4" /> Требует внимания
          </h2>
          <div className="space-y-2">
            {data.alerts.map((a, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-sm"
              >
                {a.message}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Users className="size-4" /> Команда сегодня
          </span>
          <button
            type="button"
            onClick={() => router.push(`/settings/team`)}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
          >
            Управлять <ArrowRight className="size-3" />
          </button>
        </h2>
        {data.team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            В команде пока нет мастеров. Пригласите первого через настройки команды.
          </div>
        ) : (
          <div className="space-y-2">
            {data.team.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
              >
                <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    (m.display_name || 'M')[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.display_name || 'Мастер'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.specialization || 'Без специализации'}
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${m.load_percent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        m.load_percent > 80
                          ? 'bg-rose-500'
                          : m.load_percent > 50
                            ? 'bg-emerald-500'
                            : 'bg-primary'
                      }`}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">
                    {m.appointments_today} {m.appointments_today === 1 ? 'запись' : m.appointments_today >= 2 && m.appointments_today <= 4 ? 'записи' : 'записей'}
                  </div>
                  {isUnified && m.revenue_today !== null && (
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(m.revenue_today)}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">{m.load_percent}% загрузка</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tint,
}: {
  title: string;
  value: string;
  icon: typeof TrendingUp;
  tint: 'emerald' | 'indigo' | 'violet' | 'amber' | 'sky' | 'rose';
}) {
  const tints: Record<typeof tint, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    violet: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
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
        <div className="text-xl font-semibold truncate">{value}</div>
      </div>
    </motion.div>
  );
}
