/** --- YAML
 * name: Calendar Page
 * description: Master's appointment calendar — day/week views, date navigation, new appointment button
 * --- */

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMaster } from '@/hooks/use-master';
import { useAppointments } from '@/hooks/use-appointments';
import { DayView } from '@/components/calendar/day-view';
import { WeekView } from '@/components/calendar/week-view';
import { NewAppointmentDialog } from '@/components/calendar/new-appointment-dialog';
import { AppointmentActions } from '@/components/calendar/appointment-actions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';

type ViewMode = 'day' | 'week';

export default function CalendarPage() {
  const t = useTranslations('calendar');
  const tp = useTranslations('profile');
  const { master, loading: masterLoading } = useMaster();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newDialogDefaults, setNewDialogDefaults] = useState<{ date?: string; time?: string; clientId?: string; serviceId?: string }>({});
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
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
    // Week view: find Monday
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

  const { appointments, isLoading, refetch } = useAppointments(master?.id, startDate, endDate);

  // Parse working hours for current day
  const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()];
  const dayHours = master?.working_hours?.[dayKey];
  const workStart = dayHours ? parseInt(dayHours.start.split(':')[0]) : 9;
  const workEnd = dayHours ? parseInt(dayHours.end.split(':')[0]) : 18;

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
    setNewDialogDefaults({ date: currentDate.toISOString().split('T')[0], time });
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
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!master) return null;

  const dateLabel = view === 'day'
    ? currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — ${endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>{tp('monday').charAt(0) === 'П' ? 'Сьогодні' : 'Today'}</Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{dateLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              className={`px-3 py-1 text-sm rounded-md transition-colors ${view === 'day' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              onClick={() => setView('day')}
            >
              {t('dayView')}
            </button>
            <button
              className={`px-3 py-1 text-sm rounded-md transition-colors ${view === 'week' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              onClick={() => setView('week')}
            >
              {t('weekView')}
            </button>
          </div>
          <Button onClick={() => { setNewDialogDefaults({}); setNewDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('newAppointment')}
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
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
          onDayClick={(d) => { setCurrentDate(d); setView('day'); }}
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
