/** --- YAML
 * name: WeekView
 * description: Premium 7-column grid calendar — rich day cards, polished appointment pills, today highlight
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppointmentData } from '@/hooks/use-appointments';

interface WeekViewProps {
  weekStart: Date;
  appointments: AppointmentData[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
}

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export function WeekView({
  weekStart,
  appointments,
  onDayClick,
  onAppointmentClick,
}: WeekViewProps) {
  const t = useTranslations('profile');
  const tc = useTranslations('calendar');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getAppointmentsForDay(day: Date) {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
      );
    });
  }

  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-[740px]">
      {days.map((day, i) => {
        const dayAppts = getAppointmentsForDay(day);
        const isToday = day.toDateString() === today.toDateString();
        const isPast = day < today && !isToday;

        return (
          <div
            key={i}
            className={cn(
              'rounded-2xl border bg-card shadow-sm min-h-[220px] flex flex-col overflow-hidden transition-shadow hover:shadow-md',
              isToday && 'ring-2 ring-primary/30',
            )}
          >
            {/* Day header */}
            <button
              className={cn(
                'text-center py-3 border-b cursor-pointer transition-colors',
                isToday
                  ? 'bg-primary/5'
                  : 'hover:bg-muted/50',
                isPast && 'opacity-60',
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t(DAY_KEYS[i])}
              </div>
              <div
                className={cn(
                  'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold',
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground',
                )}
              >
                {day.getDate()}
              </div>
            </button>

            {/* Appointments */}
            <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
              {dayAppts.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <span className="text-[10px] text-muted-foreground/40">
                    —
                  </span>
                </div>
              )}
              {dayAppts.map((appt) => {
                const time = new Date(appt.starts_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isCompleted = appt.status === 'completed';
                const isCancelled =
                  appt.status === 'cancelled' || appt.status === 'no_show';

                return (
                  <button
                    key={appt.id}
                    className={cn(
                      'w-full text-left rounded-lg px-2 py-1.5 text-[11px] cursor-pointer transition-all',
                      'hover:shadow-sm hover:scale-[1.02] border-l-2',
                      isCompleted && 'opacity-60',
                      isCancelled && 'opacity-40 line-through',
                    )}
                    style={{
                      borderLeftColor: appt.service?.color ?? '#6366f1',
                      backgroundColor: `${appt.service?.color ?? '#6366f1'}10`,
                    }}
                    onClick={() => onAppointmentClick(appt)}
                  >
                    <div className="flex items-center gap-1 font-semibold leading-tight">
                      {appt.client?.has_health_alert && (
                        <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                      )}
                      <span className="truncate">{time}</span>
                    </div>
                    <div className="truncate text-muted-foreground leading-tight mt-0.5">
                      {appt.client?.full_name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Day summary footer */}
            {dayAppts.length > 0 && (
              <div className="border-t px-2 py-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {dayAppts.length} {dayAppts.length === 1 ? tc('status.booked').toLowerCase() : tc('noAppointments').split(' ')[0].toLowerCase()}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
