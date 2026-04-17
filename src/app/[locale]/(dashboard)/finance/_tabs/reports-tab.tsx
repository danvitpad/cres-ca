/** --- YAML
 * name: ReportsTab
 * description: Analytics — top clients / top services / capacity utilization / new vs returning / tax CSV. Period switcher.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Receipt, Crown, Star, Calendar as CalendarIcon, UserPlus, RotateCcw,
  Download, Loader2, BarChart3,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import {
  type PageTheme, FONT, FONT_FEATURES, CURRENCY, KPI_GRADIENTS,
} from '@/lib/dashboard-theme';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, subMonths,
  format, getDay, getHours, type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

type Period = 'week' | 'month' | 'quarter' | 'year';
const PERIOD_LABEL: Record<Period, string> = {
  week: 'Эта неделя',
  month: 'Этот месяц',
  quarter: 'Этот квартал',
  year: 'Этот год',
};
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  client_id: string | null;
  service_id: string | null;
  service: { name: string; price: number } | null;
  client: { id: string; full_name: string; created_at: string; total_visits: number } | null;
}

function periodRange(p: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (p) {
    case 'week':    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':   return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'quarter': return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'year':    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  }
}

export function ReportsTab({ C }: { C: PageTheme }) {
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { master, loading: masterLoading } = useMaster();

  const [period, setPeriod] = useState<Period>('month');
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [taxLoading, setTaxLoading] = useState(false);

  const load = useCallback(async () => {
    if (!master?.id) {
      if (!masterLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { from, to } = periodRange(period);
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, starts_at, ends_at, status, price, client_id, service_id,
          service:services(name, price),
          client:clients(id, full_name, created_at, total_visits)
        `)
        .eq('master_id', master.id)
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString())
        .order('starts_at', { ascending: true });
      setAppointments((data as unknown as AppointmentRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, [master?.id, masterLoading, period]);

  useEffect(() => { load(); }, [load]);

  /* ─── Computations ─── */

  const completed = useMemo(() => appointments.filter(a => a.status === 'completed'), [appointments]);

  // Top clients by revenue in period
  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; visits: number; clientId: string }>();
    for (const a of completed) {
      if (!a.client_id || !a.client) continue;
      const existing = map.get(a.client_id) || { name: a.client.full_name || '—', revenue: 0, visits: 0, clientId: a.client_id };
      existing.revenue += Number(a.price) || 0;
      existing.visits += 1;
      map.set(a.client_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [completed]);

  // Top services
  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; bookings: number }>();
    for (const a of completed) {
      const key = a.service_id || 'no-service';
      const name = a.service?.name || 'Без услуги';
      const existing = map.get(key) || { name, revenue: 0, bookings: 0 };
      existing.revenue += Number(a.price) || 0;
      existing.bookings += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [completed]);

  // Workload by day-of-week
  const workloadByDay = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
    for (const a of appointments) {
      if (a.status === 'cancelled') continue;
      const dow = getDay(new Date(a.starts_at));
      counts[dow]++;
    }
    // Re-arrange: Mon..Sun for European locale
    return [1, 2, 3, 4, 5, 6, 0].map(i => ({ day: DAY_LABELS[i], count: counts[i] }));
  }, [appointments]);

  // Workload by hour
  const workloadByHour = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const a of appointments) {
      if (a.status === 'cancelled') continue;
      const h = getHours(new Date(a.starts_at));
      counts[h] = (counts[h] || 0) + 1;
    }
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: counts[h] || 0 }))
      .filter(r => r.count > 0);
  }, [appointments]);

  // New vs returning clients
  const clientsBreakdown = useMemo(() => {
    const { from } = periodRange(period);
    const newClients = new Set<string>();
    const returningClients = new Set<string>();
    for (const a of appointments) {
      if (!a.client_id || !a.client) continue;
      const created = new Date(a.client.created_at);
      if (created >= from) newClients.add(a.client_id);
      else returningClients.add(a.client_id);
    }
    return {
      newCount: newClients.size,
      returningCount: returningClients.size,
      total: newClients.size + returningClients.size,
    };
  }, [appointments, period]);

  // Top stats
  const stats = useMemo(() => {
    const revenue = completed.reduce((s, a) => s + (Number(a.price) || 0), 0);
    const bookings = completed.length;
    const avgCheck = bookings > 0 ? Math.round(revenue / bookings) : 0;
    const cancelled = appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length;
    const cancelRate = appointments.length > 0 ? Math.round((cancelled / appointments.length) * 100) : 0;
    return { revenue, bookings, avgCheck, cancelRate };
  }, [appointments, completed]);

  const downloadCsv = async () => {
    if (!master?.id) return;
    setTaxLoading(true);
    const now = new Date();
    window.open(`/api/reports/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, '_blank');
    setTaxLoading(false);
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ' + CURRENCY;

  const cardBase: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: 22,
    fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: C.textSecondary }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
        Загрузка аналитики...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text }}>
      {/* Header + period switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 650, margin: 0, letterSpacing: '-0.3px' }}>Аналитика</h2>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}>
            Топ клиенты, услуги, загрузка, налоги.
          </p>
        </div>

        {/* Period pill */}
        <div style={{
          display: 'inline-flex', gap: 2, background: C.surfaceElevated,
          borderRadius: 10, padding: 3,
        }}>
          {(['week', 'month', 'quarter', 'year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: period === p ? C.surface : 'transparent',
                color: period === p ? C.text : C.textTertiary,
                fontSize: 12, fontWeight: 550, cursor: 'pointer',
                fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                transition: 'all 0.15s',
                boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI gradient cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Выручка', value: fmtMoney(stats.revenue), grad: KPI_GRADIENTS.revenue },
          { label: 'Записей', value: String(stats.bookings), grad: KPI_GRADIENTS.profit },
          { label: 'Средний чек', value: fmtMoney(stats.avgCheck), grad: KPI_GRADIENTS.neutral },
          { label: 'Отмен / no-show', value: stats.cancelRate + '%', grad: KPI_GRADIENTS.expenses },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              background: k.grad, borderRadius: 16, padding: '18px 20px',
              color: '#fff', position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', right: -20, top: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* New vs Returning */}
      <div style={{ ...cardBase, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={15} style={{ color: C.accent }} />
          Клиенты в этом периоде
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Новые
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.success, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {clientsBreakdown.newCount}
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
              {clientsBreakdown.total > 0 ? Math.round((clientsBreakdown.newCount / clientsBreakdown.total) * 100) : 0}% от всех
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Вернулись
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.accent, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {clientsBreakdown.returningCount}
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
              {clientsBreakdown.total > 0 ? Math.round((clientsBreakdown.returningCount / clientsBreakdown.total) * 100) : 0}% от всех
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Всего активных
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {clientsBreakdown.total}
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
              уникальных клиентов
            </div>
          </div>
        </div>
      </div>

      {/* Top clients + Top services side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Top clients */}
        <div style={cardBase}>
          <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crown size={15} style={{ color: C.warning }} />
            Топ клиенты по выручке
          </h3>
          {topClients.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textTertiary, padding: '20px 0', textAlign: 'center' }}>
              Нет завершённых записей за период
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topClients.map((c, i) => (
                <div key={c.clientId} style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto auto', gap: 10, alignItems: 'center',
                  padding: '8px 10px', borderRadius: 8,
                  background: i < 3 ? C.accentSoft : 'transparent',
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: i < 3 ? C.accent : C.textTertiary,
                    textAlign: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 550, color: C.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: 11, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                    {c.visits} {c.visits === 1 ? 'визит' : 'визита'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                    {fmtMoney(c.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top services */}
        <div style={cardBase}>
          <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={15} style={{ color: C.warning }} />
            Топ услуги по выручке
          </h3>
          {topServices.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textTertiary, padding: '20px 0', textAlign: 'center' }}>
              Нет завершённых записей за период
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topServices.map((s, i) => (
                <div key={s.name} style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto auto', gap: 10, alignItems: 'center',
                  padding: '8px 10px', borderRadius: 8,
                  background: i < 3 ? C.accentSoft : 'transparent',
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: i < 3 ? C.accent : C.textTertiary, textAlign: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 550, color: C.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 11, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                    {s.bookings} {s.bookings === 1 ? 'запись' : 'записи'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>
                    {fmtMoney(s.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workload by day-of-week + by hour */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={cardBase}>
          <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={15} style={{ color: C.accent }} />
            Загрузка по дням недели
          </h3>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadByDay} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.textTertiary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.textTertiary }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RTooltip
                  contentStyle={{ background: C.surface, border: `1px solid ${C.borderStrong}`, borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: C.accentSoft }}
                />
                <Bar dataKey="count" fill={C.accent} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardBase}>
          <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={15} style={{ color: C.accent }} />
            Загрузка по часам
          </h3>
          {workloadByHour.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textTertiary, padding: '40px 0', textAlign: 'center' }}>
              Нет данных
            </p>
          ) : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadByHour} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.textTertiary }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.textTertiary }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{ background: C.surface, border: `1px solid ${C.borderStrong}`, borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: C.accentSoft }}
                  />
                  <Bar dataKey="count" fill={C.success} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tax / CSV export */}
      <div style={cardBase}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 650, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={15} style={{ color: C.accent }} />
              Налоговый отчёт
            </h3>
            <p style={{ fontSize: 12, color: C.textTertiary, margin: '4px 0 0' }}>
              Скачайте CSV с выручкой и расходами за текущий месяц для бухгалтера/налоговой.
            </p>
          </div>
          <button
            onClick={downloadCsv}
            disabled={taxLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: C.accent, color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {taxLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Скачать CSV за {format(new Date(), 'LLLL yyyy', { locale: dfLocale })}
          </button>
        </div>
      </div>
    </div>
  );
}
