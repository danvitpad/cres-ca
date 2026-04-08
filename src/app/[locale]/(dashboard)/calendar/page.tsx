/** --- YAML
 * name: Calendar Page
 * description: Premium master calendar — stat cards, animated day/week views, polished navigation
 * --- */

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useMaster } from '@/hooks/use-master';
import { useAppointments } from '@/hooks/use-appointments';
import { DayView } from '@/components/calendar/day-view';
import { WeekView } from '@/components/calendar/week-view';
import { NewAppointmentDialog } from '@/components/calendar/new-appointment-dialog';
import { AppointmentActions } from '@/components/calendar/appointment-actions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  TrendingUp,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';

type ViewMode = 'day' | 'week';

/** Generate smooth SVG path from data points */
function generateSparklinePath(points: number[], width: number, height: number): string {
  if (!points || points.length < 2) return `M 0 ${height}`;
  const max = Math.max(...points, 1);
  const xStep = width / (points.length - 1);
  const coords = points.map((p, i) => [
    i * xStep,
    height - (p / max) * (height * 0.8) - (height * 0.1),
  ]);
  let path = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const midX = (coords[i][0] + coords[i + 1][0]) / 2;
    path += ` C ${midX},${coords[i][1]} ${midX},${coords[i + 1][1]} ${coords[i + 1][0]},${coords[i + 1][1]}`;
  }
  return path;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  sparkData,
  delta,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  sparkData?: number[];
  delta?: number;
}) {
  const svgW = 120;
  const svgH = 40;
  const linePath = sparkData ? generateSparklinePath(sparkData, svgW, svgH) : '';
  const areaPath = linePath ? `${linePath} L ${svgW} ${svgH} L 0 ${svgH} Z` : '';
  const isPositive = (delta ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ?? 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            {delta !== undefined && (
              <span className={`flex items-center text-[10px] font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {Math.abs(delta)}%
                {isPositive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              </span>
            )}
          </div>
          <p className="text-xl font-bold leading-tight tracking-tight">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      {sparkData && sparkData.length >= 2 && (
        <div className="w-24 h-10 shrink-0 ml-2">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`spark-grad-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#spark-grad-${label.replace(/\s/g, '')})`} />
            <path d={linePath} fill="none" stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </motion.div>
  );
}

export default function CalendarPage() {
  const t = useTranslations('calendar');
  const tp = useTranslations('profile');
  const { master, loading: masterLoading } = useMaster();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newDialogDefaults, setNewDialogDefaults] = useState<{
    date?: string;
    time?: string;
    clientId?: string;
    serviceId?: string;
  }>({});
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Calculate date range based on view
  const { startDate, endDate } = useMemo(() => {
    if (view === 'day') {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    const day = currentDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(currentDate);
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }, [view, currentDate]);

  const { appointments, isLoading, refetch } = useAppointments(
    master?.id,
    startDate,
    endDate,
  );

  // Parse working hours for current day
  const dayKey = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][currentDate.getDay()];
  const dayHours = master?.working_hours?.[dayKey];
  const workStart = dayHours ? parseInt(dayHours.start.split(':')[0]) : 9;
  const workEnd = dayHours ? parseInt(dayHours.end.split(':')[0]) : 18;

  // Stats for today
  const todayStats = useMemo(() => {
    const now = new Date();
    const todayAppts = appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        a.status !== 'cancelled'
      );
    });

    const revenue = todayAppts
      .filter((a) => a.status === 'completed')
      .reduce((sum, a) => sum + (a.price || 0), 0);

    const upcoming = todayAppts
      .filter((a) => new Date(a.starts_at) > now && a.status !== 'completed')
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const next = upcoming[0] ?? null;
    let nextSub = '';
    if (next) {
      const diff = Math.round(
        (new Date(next.starts_at).getTime() - now.getTime()) / 60000,
      );
      if (diff > 0) {
        nextSub = `${t('in')} ${diff} ${t('min')}`;
      }
    }

    // Generate sparkline data — last 7 hours appointment counts
    const hourlyData: number[] = [];
    for (let h = workStart; h <= workEnd; h++) {
      hourlyData.push(
        todayAppts.filter((a) => new Date(a.starts_at).getHours() === h).length,
      );
    }

    // Revenue sparkline — cumulative by hour
    const revenueByHour: number[] = [];
    let cumulative = 0;
    for (let h = workStart; h <= workEnd; h++) {
      cumulative += todayAppts
        .filter((a) => a.status === 'completed' && new Date(a.starts_at).getHours() === h)
        .reduce((s, a) => s + (a.price || 0), 0);
      revenueByHour.push(cumulative);
    }

    return {
      total: todayAppts.length,
      revenue,
      nextClient: next?.client?.full_name ?? t('noUpcoming'),
      nextSub,
      hourlyData,
      revenueByHour,
    };
  }, [appointments, t, workStart, workEnd]);

  function navigate(delta: number) {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleSlotClick(time: string) {
    setNewDialogDefaults({
      date: currentDate.toISOString().split('T')[0],
      time,
    });
    setNewDialogOpen(true);
  }

  function handleAppointmentClick(appt: AppointmentData) {
    setSelectedAppointment(appt);
    setActionsOpen(true);
  }

  function handleRepeat(appt: AppointmentData) {
    setNewDialogDefaults({
      clientId: appt.client_id,
      serviceId: appt.service_id,
    });
    setNewDialogOpen(true);
  }

  if (masterLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!master) return null;

  const isToday = currentDate.toDateString() === new Date().toDateString();

  const dateLabel =
    view === 'day'
      ? currentDate.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : `${startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — ${endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label={t('todayAppointments')}
          value={String(todayStats.total)}
          sub={!dayHours ? t('freeDay') : undefined}
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          sparkData={todayStats.hourlyData}
        />
        <StatCard
          icon={Clock}
          label={t('nextClient')}
          value={todayStats.nextClient}
          sub={todayStats.nextSub}
          accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <StatCard
          icon={TrendingUp}
          label={t('todayRevenue')}
          value={`${todayStats.revenue.toLocaleString()} ₴`}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          sparkData={todayStats.revenueByHour}
        />
      </div>

      {/* Header — navigation + view toggle + add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border bg-card shadow-sm">
            <button
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-l-xl hover:bg-muted"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-x ${isToday ? 'text-primary' : 'text-foreground hover:text-primary'}`}
              onClick={goToToday}
            >
              {tp('monday').charAt(0) === 'П' ? 'Сьогодні' : 'Today'}
            </button>
            <button
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-r-xl hover:bg-muted"
              onClick={() => navigate(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-base font-semibold capitalize">{dateLabel}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="relative flex rounded-xl border bg-card p-1 shadow-sm">
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                className={`relative z-10 px-3.5 py-1.5 text-sm font-medium transition-colors rounded-lg ${
                  view === v ? 'text-foreground' : 'text-muted-foreground'
                }`}
                onClick={() => setView(v)}
              >
                {view === v && (
                  <motion.div
                    layoutId="view-toggle"
                    className="absolute inset-0 rounded-lg bg-muted"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">{v === 'day' ? t('dayView') : t('weekView')}</span>
              </button>
            ))}
          </div>

          {/* New appointment */}
          <Button
            className="rounded-xl shadow-sm"
            onClick={() => {
              setNewDialogDefaults({});
              setNewDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">{t('newAppointment')}</span>
            <span className="sm:hidden">+</span>
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : view === 'day' ? (
        <DayView
          date={currentDate}
          appointments={appointments}
          workStart={workStart}
          workEnd={workEnd}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
          onRefetch={refetch}
        />
      ) : (
        <WeekView
          weekStart={startDate}
          appointments={appointments}
          onDayClick={(d) => {
            setCurrentDate(d);
            setView('day');
          }}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {/* Dialogs */}
      <NewAppointmentDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        masterId={master.id}
        defaultDate={newDialogDefaults.date}
        defaultTime={newDialogDefaults.time}
        defaultClientId={newDialogDefaults.clientId}
        defaultServiceId={newDialogDefaults.serviceId}
        onCreated={refetch}
      />
      <AppointmentActions
        appointment={selectedAppointment}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        onUpdated={refetch}
        onRepeat={handleRepeat}
      />
    </div>
  );
}
