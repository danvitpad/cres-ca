/** --- YAML
 * name: WeekView
 * description: Fresha-style 7-column week grid — day headers with dates, hourly time grid, appointment blocks
 * --- */

'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppointmentData } from '@/hooks/use-appointments';

const HOUR_HEIGHT = 48;
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const TIME_COL_WIDTH = 52;
const WORK_START = 9;
const WORK_END = 18;

interface WeekViewProps {
  weekStart: Date;
  appointments: AppointmentData[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
}

const DAY_KEYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

export function WeekView({
  weekStart,
  appointments,
  onDayClick,
  onAppointmentClick,
}: WeekViewProps) {
  const t = useTranslations('profile');
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (WORK_START - 1) * HOUR_HEIGHT);
    }
  }, []);

  function getApptsForDay(day: Date) {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
      );
    });
  }

  function timeToY(dateStr: string): number {
    const d = new Date(dateStr);
    return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
  }

  function durationToH(startStr: string, endStr: string): number {
    const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
    return (ms / (1000 * 60 * 60)) * HOUR_HEIGHT;
  }

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Day headers — sticky */}
      <div className="flex border-b border-border/50 bg-background sticky top-0 z-20">
        {/* Time column spacer */}
        <div className="shrink-0" style={{ width: TIME_COL_WIDTH }} />

        {days.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              className={cn(
                'flex-1 text-center py-2.5 border-l border-border/30 cursor-pointer hover:bg-muted/30 transition-colors',
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t(DAY_KEYS[i]).slice(0, 3)}
              </div>
              <div
                className={cn(
                  'mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex relative" style={{ height: TOTAL_HEIGHT }}>
          {/* Time labels column */}
          <div className="shrink-0 relative" style={{ width: TIME_COL_WIDTH }}>
            {Array.from({ length: TOTAL_HOURS }, (_, hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                <span className="absolute top-0 -translate-y-1/2 w-full text-right pr-3 text-xs text-muted-foreground select-none">
                  {`${String(hour).padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayAppts = getApptsForDay(day);

            return (
              <div
                key={dayIndex}
                className="flex-1 relative border-l border-border/30"
              >
                {/* Hour grid lines + non-working zones */}
                {Array.from({ length: TOTAL_HOURS }, (_, hour) => {
                  const isWorking = hour >= WORK_START && hour < WORK_END;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        'absolute left-0 right-0 border-t border-border/30',
                        !isWorking && 'bg-muted/30',
                      )}
                      style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    >
                      {/* Half-hour line */}
                      <div
                        className="absolute left-0 right-0 border-t border-border/15"
                        style={{ top: HOUR_HEIGHT / 2 }}
                      />
                    </div>
                  );
                })}

                {/* Appointments */}
                {dayAppts.map((appt) => {
                  const top = timeToY(appt.starts_at);
                  const height = durationToH(appt.starts_at, appt.ends_at);
                  const color = appt.service?.color || '#6366f1';
                  const isCancelled = appt.status === 'cancelled' || appt.status === 'no_show';

                  return (
                    <div
                      key={appt.id}
                      className={cn(
                        'absolute left-0.5 right-0.5 rounded border-l-[3px] px-1.5 py-1 cursor-pointer',
                        'hover:shadow-sm hover:brightness-95 transition-all text-[11px] overflow-hidden',
                        isCancelled && 'opacity-40',
                      )}
                      style={{
                        top: Math.max(0, top),
                        height: Math.max(20, height),
                        zIndex: 10,
                        borderLeftColor: color,
                        backgroundColor: `${color}18`,
                      }}
                      onClick={() => onAppointmentClick(appt)}
                    >
                      <div className="flex items-center gap-1 font-semibold leading-tight truncate" style={{ color }}>
                        {appt.client?.has_health_alert && (
                          <AlertTriangle className="size-2.5 text-red-500 shrink-0" />
                        )}
                        <span className="truncate">
                          {new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {height > 28 && (
                        <div className="truncate text-muted-foreground leading-tight">
                          {appt.client?.full_name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Current time line across all columns */}
          {(() => {
            const now = new Date();
            const isThisWeek = days.some((d) => d.toDateString() === now.toDateString());
            if (!isThisWeek) return null;
            const y = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
            return (
              <div
                className="absolute z-20 pointer-events-none"
                style={{ top: y, left: TIME_COL_WIDTH, right: 0 }}
              >
                <div className="flex items-center">
                  <div className="size-2 rounded-full bg-red-500 -translate-x-1 shrink-0" />
                  <div className="flex-1 h-[2px] bg-red-500" />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
