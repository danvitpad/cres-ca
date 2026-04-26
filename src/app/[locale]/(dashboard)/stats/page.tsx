/** --- YAML
 * name: Statistics Page
 * description: Dedicated stats route — extracted from /today which had become
 *              over-stuffed. Owns three blocks the master used to scroll past on
 *              the home dashboard: weekly load bars, top services donut-list, and
 *              the booking lifecycle stats with day/week/month period switcher.
 *              Uses the same data shape as before so visual parity is preserved.
 * created: 2026-04-26
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Calendar as CalendarIcon, Bell,
  CheckCircle2, XCircle, UserX, RotateCcw,
} from 'lucide-react';
import { startOfWeek, endOfDay } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';

interface Appointment {
  id: string;
  starts_at: string;
  status: string;
  client_id: string | null;
  service: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null;
}

type StatsPeriod = 'day' | 'week' | 'month';

const ACCENT_BG: Record<string, string> = {
  violet: 'bg-violet-500/10 text-violet-500',
  blue: 'bg-blue-500/10 text-blue-500',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  rose: 'bg-rose-500/10 text-rose-500',
  amber: 'bg-amber-500/10 text-amber-600',
  sky: 'bg-sky-500/10 text-sky-500',
};

export default function StatsPage() {
  const { master, loading: masterLoading } = useMaster();
  const { C, mounted } = usePageTheme();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('week');
  const [bookingStats, setBookingStats] = useState({
    total: 0, completed: 0, cancelled: 0, no_show: 0, rescheduled: 0, upcoming: 0,
  });
  const [loading, setLoading] = useState(true);

  // Weekly load + top services pull from the current week, not the period
  // selector (period only affects the lifecycle tiles below).
  const fetchWeek = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfDay(now);
    const { data } = await supabase.from('appointments')
      .select('id, starts_at, status, client_id, service:services(id, name, color)')
      .eq('master_id', master.id)
      .gte('starts_at', weekStart.toISOString())
      .lte('starts_at', weekEnd.toISOString())
      .order('starts_at', { ascending: true });
    setAppointments((data as unknown as Appointment[]) ?? []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => { if (!masterLoading && master?.id) fetchWeek(); }, [masterLoading, master?.id, fetchWeek]);

  // Lifecycle stats — separate per-period fetch
  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const start = new Date(now);
    if (statsPeriod === 'day') start.setHours(0, 0, 0, 0);
    else if (statsPeriod === 'week') { start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0); }
    else { start.setDate(now.getDate() - 29); start.setHours(0, 0, 0, 0); }
    const end = new Date(now); end.setHours(23, 59, 59, 999);

    (async () => {
      const [apptRes, reschedRes] = await Promise.all([
        supabase.from('appointments')
          .select('id, status, starts_at')
          .eq('master_id', master.id)
          .gte('starts_at', start.toISOString())
          .lte('starts_at', end.toISOString()),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('data->>kind', 'booking_rescheduled')
          .gte('created_at', start.toISOString()),
      ]);
      const list = (apptRes.data ?? []) as Array<{ id: string; status: string; starts_at: string }>;
      setBookingStats({
        total:       list.length,
        completed:   list.filter((a) => a.status === 'completed').length,
        cancelled:   list.filter((a) => a.status === 'cancelled' || a.status === 'cancelled_by_client').length,
        no_show:     list.filter((a) => a.status === 'no_show').length,
        upcoming:    list.filter((a) => (a.status === 'booked' || a.status === 'confirmed') && new Date(a.starts_at) >= now).length,
        rescheduled: reschedRes.count ?? 0,
      });
    })();
  }, [master?.id, statsPeriod]);

  // Weekly load bars (Mon..Sun, ignores cancellations)
  const weeklyLoad = useMemo(() => {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const counts = new Array(7).fill(0);
    for (const a of appointments) {
      if (a.status === 'cancelled' || a.status === 'cancelled_by_client' || a.status === 'cancelled_by_master') continue;
      const dayIdx = (new Date(a.starts_at).getDay() + 6) % 7;
      counts[dayIdx] += 1;
    }
    const max = Math.max(1, ...counts);
    return labels.map((label, i) => ({ label, value: counts[i], ratio: counts[i] / max }));
  }, [appointments]);

  // Top services this week
  const topServices = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; color: string; count: number }>();
    for (const a of appointments) {
      const svc = Array.isArray(a.service) ? a.service[0] : a.service;
      if (!svc) continue;
      const e = byId.get(svc.id);
      if (e) e.count += 1;
      else byId.set(svc.id, { id: svc.id, name: svc.name, color: svc.color ?? '#8b5cf6', count: 1 });
    }
    const arr = Array.from(byId.values()).sort((a, b) => b.count - a.count).slice(0, 8);
    const total = arr.reduce((s, x) => s + x.count, 0);
    return { items: arr, total };
  }, [appointments]);

  if (!mounted) return null;

  return (
    <div style={{
      ...pageContainer,
      color: C.text, background: C.bg, minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: C.accentSoft,
          border: `1px solid ${C.aiBorder}`,
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 28,
        }}
      >
        <h1 style={{
          fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <BarChart3 size={24} style={{ color: C.accent }} />
          Статистика
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: '6px 0 0', lineHeight: 1.5 }}>
          Загрузка по дням, топ услуг за неделю и жизненный цикл записей с переключателем периода.
        </p>
      </motion.div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Weekly load bars */}
          <div className="md:col-span-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Загрузка по дням</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {weeklyLoad.reduce((s, d) => s + d.value, 0)} записей
              </span>
            </div>
            <div className="flex items-end gap-2 h-36">
              {weeklyLoad.map((d) => (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full rounded-md transition-all"
                    style={{
                      background: C.accent,
                      height: `${Math.max(6, d.ratio * 88)}px`,
                      opacity: d.value === 0 ? 0.15 : 0.45 + d.ratio * 0.55,
                    }}
                    title={`${d.value}`}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">{d.label}</span>
                  <span className="text-[10px] tabular-nums text-foreground/70">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Top services list */}
          <div className="md:col-span-2 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Топ услуги</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{topServices.total}</span>
            </div>
            {topServices.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Нет услуг за эту неделю</p>
            ) : (
              <ul className="space-y-1.5">
                {topServices.items.map((s) => {
                  const pct = topServices.total > 0 ? Math.round((s.count / topServices.total) * 100) : 0;
                  return (
                    <li key={s.id} className="flex items-center gap-2 text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{s.count}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground/70 w-9 text-right">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Booking lifecycle */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Статистика записей</h2>
            <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setStatsPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    statsPeriod === p
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === 'day' ? 'Сегодня' : p === 'week' ? '7 дней' : '30 дней'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <Tile icon={<CalendarIcon className="w-4 h-4" />}    label="Всего"      value={bookingStats.total}       accent="violet" />
            <Tile icon={<Bell className="w-4 h-4" />}            label="Предстоит"  value={bookingStats.upcoming}    accent="blue"   />
            <Tile icon={<CheckCircle2 className="w-4 h-4" />}    label="Завершено"  value={bookingStats.completed}   accent="emerald"/>
            <Tile icon={<XCircle className="w-4 h-4" />}         label="Отменено"   value={bookingStats.cancelled}   accent="rose"   />
            <Tile icon={<UserX className="w-4 h-4" />}           label="Не пришли"  value={bookingStats.no_show}     accent="amber"  />
            <Tile icon={<RotateCcw className="w-4 h-4" />}       label="Перенесено" value={bookingStats.rescheduled} accent="sky"    />
          </div>
        </div>

        {loading && (
          <p className="text-xs text-muted-foreground text-center py-3">Загрузка…</p>
        )}
      </div>
    </div>
  );
}

function Tile({
  icon, label, value, accent,
}: {
  icon: React.ReactNode; label: string; value: number;
  accent: 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'sky';
}) {
  return (
    <div className="rounded-lg border bg-background/40 p-2.5">
      <div className={`inline-flex items-center justify-center size-7 rounded-md ${ACCENT_BG[accent]}`}>
        {icon}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground leading-none">{label}</div>
    </div>
  );
}
