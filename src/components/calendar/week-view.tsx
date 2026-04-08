/** --- YAML
 * name: WeekView
 * description: 7-column grid calendar showing compact appointment blocks per day
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';

interface WeekViewProps {
  weekStart: Date;
  appointments: AppointmentData[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
}

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function WeekView({ weekStart, appointments, onDayClick, onAppointmentClick }: WeekViewProps) {
  const t = useTranslations('profile');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getAppointmentsForDay(day: Date) {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
    });
  }

  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-1 overflow-x-auto min-w-[700px]">
      {days.map((day, i) => {
        const dayAppts = getAppointmentsForDay(day);
        const isToday = day.toDateString() === today.toDateString();

        return (
          <div key={i} className="border rounded-lg min-h-[200px]">
            <div
              className={`text-center text-xs font-medium py-2 border-b cursor-pointer hover:bg-muted/50 ${isToday ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onDayClick(day)}
            >
              <div>{t(DAY_KEYS[i])}</div>
              <div className="text-lg font-bold">{day.getDate()}</div>
            </div>
            <div className="p-1 space-y-1">
              {dayAppts.map((appt) => {
                const time = new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={appt.id}
                    className="rounded px-1 py-0.5 text-[10px] cursor-pointer hover:opacity-80 border-l-2"
                    style={{ borderLeftColor: appt.service?.color ?? '#6366f1', backgroundColor: `${appt.service?.color ?? '#6366f1'}15` }}
                    onClick={() => onAppointmentClick(appt)}
                  >
                    <div className="font-medium truncate flex items-center gap-0.5">
                      {appt.client?.has_health_alert && <AlertTriangle className="h-2.5 w-2.5 text-red-500" />}
                      {time}
                    </div>
                    <div className="truncate text-muted-foreground">{appt.client?.full_name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
