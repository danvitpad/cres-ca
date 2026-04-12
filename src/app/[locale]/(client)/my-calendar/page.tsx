/** --- YAML
 * name: ClientCalendarPage
 * description: Google-Calendar-style client calendar with inline event chips, view switcher (month/agenda), today button
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, X, Calendar as CalendarIcon } from 'lucide-react';
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
  const [view, setView] = useState<'month' | 'agenda'>('month');
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

  const nowMs = today.getTime();
  const upcomingAppts = useMemo(() => {
    return [...appointments]
      .filter((a) => new Date(a.starts_at).getTime() >= nowMs - 60_000)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [appointments, nowMs]);

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

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t('today')}
          </button>
          <div className="flex items-center">
            <button onClick={prevMonth} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={nextMonth} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-xl font-semibold capitalize tracking-tight">{monthLabel}</h2>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 rounded-full border border-border/60 bg-card p-1">
          {(['month', 'agenda'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-medium transition-all',
                view === v ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(v === 'month' ? 'viewMonth' : 'viewAgenda')}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid — Google-style cells */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              if (day === null) {
                return <div key={`e${i}`} className="min-h-[120px] border-b border-r border-border/40 bg-muted/10 last:border-r-0" />;
              }
              const dayDate = new Date(year, month, day);
              const isToday = sameDay(dayDate, today);
              const isSelected = day === selectedDay;
              const dayAppts = (appointmentsByDay.get(day) ?? []).slice().sort((a, b) =>
                new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
              );
              const visibleAppts = dayAppts.slice(0, 3);
              const remaining = dayAppts.length - visibleAppts.length;

              return (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedDay(day);
                    if (dayAppts.length) setSheetOpen(true);
                  }}
                  className={cn(
                    'group/cell relative flex min-h-[120px] flex-col gap-1 border-b border-r border-border/40 p-1.5 text-left transition-colors last:border-r-0 hover:bg-muted/40',
                    isSelected && 'bg-[var(--ds-accent)]/5 ring-1 ring-inset ring-[var(--ds-accent)]/40',
                  )}
                >
                  {/* Day number */}
                  <div className="flex justify-end px-1">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                        isToday && 'bg-[var(--ds-accent)] text-white shadow-sm',
                        !isToday && 'text-foreground',
                      )}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Inline event chips */}
                  <div className="flex flex-1 flex-col gap-0.5">
                    {visibleAppts.map((appt) => {
                      const startTime = new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const color = appt.service?.color ?? 'var(--ds-accent)';
                      return (
                        <div
                          key={appt.id}
                          className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                          style={{
                            backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
                            color: color,
                            borderLeft: `2px solid ${color}`,
                          }}
                        >
                          <span className="tabular-nums opacity-80">{startTime}</span>{' '}
                          <span className="opacity-95">{appt.service?.name ?? '—'}</span>
                        </div>
                      );
                    })}
                    {remaining > 0 && (
                      <span className="px-1.5 text-[10px] font-medium text-muted-foreground">
                        {t('moreEvents', { count: remaining })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'agenda' && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
          {upcomingAppts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarIcon className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">{t('noUpcoming')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {upcomingAppts.map((appt) => {
                const dt = new Date(appt.starts_at);
                const startTime = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateLabel = dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
                const color = appt.service?.color ?? 'var(--ds-accent)';
                return (
                  <li key={appt.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40">
                    <div className="flex w-16 shrink-0 flex-col items-center rounded-xl p-2" style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)` }}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{dateLabel}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color }}>{startTime}</span>
                    </div>
                    {appt.master && (
                      <AvatarRing src={masterAvatar(appt.master)} name={masterName(appt.master)} size={40} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{appt.service?.name ?? '—'}</p>
                      <p className="truncate text-xs text-muted-foreground">{masterName(appt.master)}</p>
                    </div>
                    <button
                      onClick={() => downloadIcs(appt)}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={t('addToCalendar')}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setCancelTarget(appt); setCancelReason(''); }}
                      className="shrink-0 rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                      title={t('cancel')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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
              const isUpcoming = new Date(appt.starts_at).getTime() > nowMs && (appt.status === 'booked' || appt.status === 'confirmed');
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
