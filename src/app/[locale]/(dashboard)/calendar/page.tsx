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
} from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';

type ViewMode = 'day' | 'week';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ?? 'bg-primary/10 text-primary'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight tracking-tight">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
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

    return {
      total: todayAppts.length,
      revenue,
      nextClient: next?.client?.full_name ?? t('noUpcoming'),
      nextSub,
    };
  }, [appointments, t]);

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
          value={`${todayStats.revenue.toLocaleString()} ${master?.city ? '₴' : '₴'}`}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
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
