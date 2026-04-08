/** --- YAML
 * name: DayView
 * description: Vertical timeline calendar for a single day — 30min grid, colored appointment blocks, drag-and-drop
 * --- */

'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle } from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';

const SLOT_HEIGHT = 48; // px per 30 min
const MINUTES_PER_SLOT = 30;
const GRID_SNAP = 15; // snap to 15 min

interface DayViewProps {
  date: Date;
  appointments: AppointmentData[];
  workStart: number; // hour, e.g. 9
  workEnd: number;   // hour, e.g. 18
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
  onRefetch: () => void;
}

export function DayView({ date, appointments, workStart, workEnd, onSlotClick, onAppointmentClick, onRefetch }: DayViewProps) {
  const t = useTranslations('calendar');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const totalSlots = (workEnd - workStart) * 2; // 30-min slots
  const totalHeight = totalSlots * SLOT_HEIGHT;

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

    const durationMs = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
    const endDate = new Date(startDate.getTime() + durationMs);

    // Check overlap
    const hasOverlap = appointments.some((a) => {
      if (a.id === appointmentId) return false;
      const aStart = new Date(a.starts_at).getTime();
      const aEnd = new Date(a.ends_at).getTime();
      return startDate.getTime() < aEnd && endDate.getTime() > aStart;
    });

    if (hasOverlap) { toast.error('Time slot is occupied'); return; }

    const supabase = createClient();
    const { error } = await supabase.from('appointments').update({
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
    }).eq('id', appointmentId);

    if (error) toast.error(error.message);
    else onRefetch();
    setDragId(null);
  }

  function handleSlotClick(index: number) {
    const hours = workStart + Math.floor(index / 2);
    const minutes = (index % 2) * 30;
    onSlotClick(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  }

  return (
    <div className="relative border rounded-lg overflow-hidden" ref={containerRef}>
      {/* Time labels + grid */}
      <div className="relative" style={{ height: totalHeight }}>
        {Array.from({ length: totalSlots + 1 }, (_, i) => {
          const hours = workStart + Math.floor(i / 2);
          const minutes = (i % 2) * 30;
          const label = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-muted flex items-start cursor-pointer hover:bg-muted/30"
              style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              onClick={() => handleSlotClick(i)}
            >
              <span className="text-[10px] text-muted-foreground w-12 pl-1 -mt-[7px] select-none">{label}</span>
            </div>
          );
        })}

        {/* Appointment blocks */}
        {appointments.map((appt) => {
          const top = timeToPosition(appt.starts_at);
          const height = durationToHeight(appt.starts_at, appt.ends_at);
          const statusColors: Record<string, string> = {
            booked: 'bg-blue-500/20 border-blue-500',
            confirmed: 'bg-indigo-500/20 border-indigo-500',
            in_progress: 'bg-yellow-500/20 border-yellow-500',
            completed: 'bg-green-500/20 border-green-500',
            cancelled: 'bg-gray-400/20 border-gray-400',
            no_show: 'bg-red-500/20 border-red-500',
          };
          const colors = statusColors[appt.status] ?? 'bg-blue-500/20 border-blue-500';

          return (
            <div
              key={appt.id}
              className={`absolute left-12 right-1 rounded border-l-4 px-2 py-1 cursor-pointer transition-shadow hover:shadow-md ${colors} ${dragId === appt.id ? 'opacity-50' : ''}`}
              onClick={() => onAppointmentClick(appt)}
              draggable
              onDragStart={() => setDragId(appt.id)}
              onDragEnd={(e) => {
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                handleDrop(appt.id, e.clientY - rect.top);
              }}
              style={{ top: Math.max(0, top), height: Math.max(24, height), zIndex: 10, borderLeftColor: appt.service?.color ?? undefined }}
            >
              <div className="flex items-center gap-1 text-xs font-medium truncate">
                {appt.client?.has_health_alert && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                {appt.client?.full_name ?? '—'}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{appt.service?.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
