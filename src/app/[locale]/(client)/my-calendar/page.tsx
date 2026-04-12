/** --- YAML
 * name: ClientCalendarPage
 * description: Client unified calendar showing appointments across all masters with monthly grid and day detail
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { BottomSheet } from '@/components/shared/primitives/bottom-sheet';
import { ShimmerSkeleton } from '@/components/shared/primitives/shimmer-skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ClientAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service: { name: string; color: string | null } | null;
  master: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profile: { full_name: string | null; avatar_url: string | null } | null;
  } | null;
}

function masterName(m: ClientAppointment['master']): string {
  return m?.display_name ?? m?.profile?.full_name ?? '';
}

function masterAvatar(m: ClientAppointment['master']): string | null {
  return m?.avatar_url ?? m?.profile?.avatar_url ?? null;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0
  const total = daysInMonth(year, month);
  const grid: (number | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= total; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function generateIcs(appt: ClientAppointment): string {
  const start = new Date(appt.starts_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(appt.ends_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CRES-CA//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${appt.service?.name ?? 'Appointment'} — ${masterName(appt.master)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(appt: ClientAppointment) {
  const blob = new Blob([generateIcs(appt)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appointment-${appt.id.slice(0, 8)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientCalendarPage() {
  const t = useTranslations('clientCalendar');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ClientAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const fetchAppointments = useCallback(async () => {
    const supabase = createClient();
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, starts_at, ends_at, status, master_id,
        service:services(name, color),
        master:masters!inner(id, display_name, avatar_url, profile:profiles(full_name, avatar_url))
      `)
      .gte('starts_at', start)
      .lte('starts_at', end)
      .order('starts_at');

    setAppointments((data ?? []) as unknown as ClientAppointment[]);
    setLoading(false);
  }, [year, month]);

  async function submitCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: cancelReason.trim() || null,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'client',
      })
      .eq('id', cancelTarget.id);
    if (error) {
      toast.error(error.message);
      setCancelBusy(false);
      return;
    }

    const { data: masterRow } = await supabase
      .from('masters')
      .select('profile_id')
      .eq('id', cancelTarget.master?.id ?? '')
      .maybeSingle();
    if (masterRow?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: masterRow.profile_id,
        channel: 'telegram',
        title: '❌ Client cancelled',
        body: `${cancelTarget.service?.name ?? 'Appointment'} on ${new Date(cancelTarget.starts_at).toLocaleString()} cancelled${cancelReason.trim() ? `: ${cancelReason.trim()}` : ''}. [cancel:${cancelTarget.id}]`,
        scheduled_for: new Date().toISOString(),
      });
    }

    if (cancelTarget.master?.id) {
      const aptDate = new Date(cancelTarget.starts_at).toISOString().split('T')[0];
      const slotTime = new Date(cancelTarget.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const { data: waitlistEntries } = await supabase
        .from('waitlist')
        .select('id, clients(profile_id)')
        .eq('master_id', cancelTarget.master.id)
        .eq('desired_date', aptDate);
      if (waitlistEntries?.length) {
        const rows = waitlistEntries
          .map((w) => {
            const c = w.clients as unknown as { profile_id: string | null } | null;
            if (!c?.profile_id) return null;
            return {
              profile_id: c.profile_id,
              channel: 'telegram',
              title: '🎉 A slot just opened up!',
              body: `A time slot became available on ${aptDate} at ${slotTime}. [waitlist:${cancelTarget.id}]`,
              scheduled_for: new Date().toISOString(),
            };
          })
          .filter((x): x is NonNullable<typeof x> => !!x);
        if (rows.length) await supabase.from('notifications').insert(rows);
        await supabase.from('waitlist').delete().in('id', waitlistEntries.map((w) => w.id));
      }
    }

    toast.success(t('cancelDone'));
    setCancelTarget(null);
    setCancelReason('');
    setCancelBusy(false);
    fetchAppointments();
  }

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<number, ClientAppointment[]>();
    for (const a of appointments) {
      const d = new Date(a.starts_at).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(a);
    }
    return map;
  }, [appointments]);

  const selectedAppts = selectedDay ? appointmentsByDay.get(selectedDay) ?? [] : [];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="p-[var(--space-page)] space-y-4">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }

  return (
    <div className="p-[var(--space-page)]">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <button onClick={nextMonth} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium uppercase text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dayDate = new Date(year, month, day);
          const isToday = sameDay(dayDate, today);
          const isSelected = day === selectedDay;
          const dayAppts = appointmentsByDay.get(day);
          const uniqueColors = dayAppts
            ? [...new Set(dayAppts.map((a) => a.service?.color ?? '#8b5cf6'))]
            : [];

          return (
            <button
              key={day}
              onClick={() => {
                setSelectedDay(day);
                if (dayAppts?.length) setSheetOpen(true);
              }}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-xl py-2 text-sm transition-all',
                isToday && !isSelected && 'font-bold text-[var(--ds-accent)]',
                isSelected && 'bg-[var(--ds-accent)] text-white font-bold',
                !isSelected && 'hover:bg-muted',
              )}
            >
              {day}
              {/* Appointment dots */}
              {uniqueColors.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {uniqueColors.slice(0, 3).map((color, ci) => (
                    <span
                      key={ci}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? '#fff' : color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom sheet with day's appointments */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} snapPoints={[0.45, 0.85]}>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            {selectedDay && new Date(year, month, selectedDay).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>
          {selectedAppts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noAppointments')}</p>
          )}
          <AnimatePresence>
            {selectedAppts.map((appt, i) => {
              const startTime = new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const endTime = new Date(appt.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isUpcoming = new Date(appt.starts_at).getTime() > Date.now() && (appt.status === 'booked' || appt.status === 'confirmed');
              return (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] border p-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: appt.service?.color ?? '#8b5cf6' }}
                >
                  {appt.master && (
                    <AvatarRing
                      src={masterAvatar(appt.master)}
                      name={masterName(appt.master)}
                      size={40}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{appt.service?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {masterName(appt.master)} &middot; {startTime}–{endTime}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadIcs(appt)}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t('addToCalendar')}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {isUpcoming && (
                    <button
                      onClick={() => { setCancelTarget(appt); setCancelReason(''); }}
                      className="shrink-0 rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                      title={t('cancel')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </BottomSheet>

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {cancelTarget.service?.name} — {new Date(cancelTarget.starts_at).toLocaleString()}
              </p>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('cancelReasonPlaceholder')}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelBusy}>
                  {t('cancelKeep')}
                </Button>
                <Button variant="destructive" onClick={submitCancel} disabled={cancelBusy}>
                  {cancelBusy ? '…' : t('cancelConfirm')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
