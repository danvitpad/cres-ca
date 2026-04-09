/** --- YAML
 * name: DayView
 * description: Premium vertical timeline calendar — 30min grid, gradient appointment blocks, current time indicator, drag-and-drop
 * --- */

'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppointmentData } from '@/hooks/use-appointments';

const SLOT_HEIGHT = 56; // px per 30 min — taller for breathing room
const GRID_SNAP = 15; // snap to 15 min

interface DayViewProps {
  date: Date;
  appointments: AppointmentData[];
  workStart: number;
  workEnd: number;
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
  onRefetch: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  booked: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  confirmed: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'border-l-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  in_progress: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-l-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  completed: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-l-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  cancelled: {
    bg: 'bg-muted/60',
    border: 'border-l-muted-foreground/40',
    text: 'text-muted-foreground',
  },
  no_show: {
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    border: 'border-l-red-500',
    text: 'text-red-700 dark:text-red-300',
  },
};

export function DayView({
  date,
  appointments,
  workStart,
  workEnd,
  onSlotClick,
  onAppointmentClick,
  onRefetch,
}: DayViewProps) {
  const t = useTranslations('calendar');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [currentMinute, setCurrentMinute] = useState(0);

  const totalSlots = (workEnd - workStart) * 2;
  const totalHeight = totalSlots * SLOT_HEIGHT;

  // Current time tracker
  const isToday = date.toDateString() === new Date().toDateString();

  useEffect(() => {
    if (!isToday) return;
    function update() {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    }
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [isToday]);

  const currentTimePosition = isToday
    ? ((currentMinute / 60 - workStart) / (workEnd - workStart)) * totalHeight
    : -1;

  function timeToPosition(dateStr: string): number {
    const d = new Date(dateStr);
    const hours = d.getHours() + d.getMinutes() / 60;
    return ((hours - workStart) / (workEnd - workStart)) * totalHeight;
  }

  function durationToHeight(startStr: string, endStr: string): number {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return (durationHours / (workEnd - workStart)) * totalHeight;
  }

  function positionToTime(y: number): string {
    const totalMinutes = (y / totalHeight) * (workEnd - workStart) * 60;
    const snapped = Math.round(totalMinutes / GRID_SNAP) * GRID_SNAP;
    const hours = workStart + Math.floor(snapped / 60);
    const minutes = snapped % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  async function handleDrop(appointmentId: string, newY: number) {
    const time = positionToTime(newY);
    const [hours, minutes] = time.split(':').map(Number);
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return;

    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);

    const durationMs =
      new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
    const endDate = new Date(startDate.getTime() + durationMs);

    const hasOverlap = appointments.some((a) => {
      if (a.id === appointmentId) return false;
      const aStart = new Date(a.starts_at).getTime();
      const aEnd = new Date(a.ends_at).getTime();
      return startDate.getTime() < aEnd && endDate.getTime() > aStart;
    });

    if (hasOverlap) {
      toast.error('Time slot is occupied');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('appointments')
      .update({
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
      })
      .eq('id', appointmentId);

    if (error) toast.error(error.message);
    else onRefetch();
    setDragId(null);
  }

  function handleSlotClick(index: number) {
    const hours = workStart + Math.floor(index / 2);
    const minutes = (index % 2) * 30;
    onSlotClick(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    );
  }

  return (
    <div
      className="relative rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)] overflow-hidden"
      ref={containerRef}
    >
      {/* Time grid */}
      <div className="relative" style={{ height: totalHeight }}>
        {Array.from({ length: totalSlots + 1 }, (_, i) => {
          const hours = workStart + Math.floor(i / 2);
          const minutes = (i % 2) * 30;
          const label = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          const isHour = minutes === 0;

          return (
            <div
              key={i}
              className={cn(
                'group absolute left-0 right-0 flex items-start cursor-pointer transition-colors hover:bg-[var(--ds-accent-soft)]/30',
                isHour ? 'border-t border-border' : 'border-t border-border/30',
              )}
              style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              onClick={() => handleSlotClick(i)}
            >
              {/* Hover "+" indicator for empty slots */}
              <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 pointer-events-none hidden sm:block">
                +
              </span>
              <span
                className={cn(
                  'w-16 pl-3 -mt-[8px] select-none text-right pr-3',
                  isHour
                    ? 'text-xs font-medium text-muted-foreground'
                    : 'text-[10px] text-muted-foreground/50',
                )}
              >
                {label}
              </span>
            </div>
          );
        })}

        {/* Current time indicator */}
        {isToday &&
          currentTimePosition >= 0 &&
          currentTimePosition <= totalHeight && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{ top: currentTimePosition }}
            >
              <div className="flex items-center">
                <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-card ml-[52px] -translate-x-1/2 shadow-sm" />
                <div className="flex-1 h-[2px] bg-red-500/80" />
              </div>
            </div>
          )}

        {/* Appointment blocks */}
        {appointments.map((appt) => {
          const top = timeToPosition(appt.starts_at);
          const height = durationToHeight(appt.starts_at, appt.ends_at);
          const styles = STATUS_STYLES[appt.status] ?? STATUS_STYLES.booked;

          const startTime = new Date(appt.starts_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const endTime = new Date(appt.ends_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={appt.id}
              className={cn(
                'absolute left-16 right-3 rounded-xl border-l-[3px] px-3 py-2 cursor-pointer transition-all duration-200',
                'hover:shadow-md hover:scale-[1.01] hover:z-20',
                styles.bg,
                styles.border,
                dragId === appt.id && 'opacity-40 scale-95',
              )}
              onClick={() => onAppointmentClick(appt)}
              draggable
              onDragStart={() => setDragId(appt.id)}
              onDragEnd={(e) => {
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                handleDrop(appt.id, e.clientY - rect.top);
              }}
              style={{
                top: Math.max(0, top),
                height: Math.max(32, height),
                zIndex: 10,
                borderLeftColor: appt.service?.color ?? undefined,
                backgroundColor: appt.service?.color ? `${appt.service.color}12` : undefined,
              }}
            >
              <div className="flex items-center gap-1.5">
                {appt.client?.has_health_alert && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className={cn('text-sm font-semibold truncate', styles.text)}>
                  {appt.client?.full_name ?? '—'}
                </span>
              </div>
              {height > 44 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">
                    {appt.service?.name}
                  </span>
                </div>
              )}
              {height > 64 && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground/60">
                    {startTime} — {endTime}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {appointments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center opacity-40">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t('noAppointments')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
