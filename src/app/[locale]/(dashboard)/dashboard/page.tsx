/** --- YAML
 * name: Dashboard Overview
 * description: Master's operational dashboard — compact single-screen layout. Finance strip + 3-block grid (schedule, stats, birthdays). Linear.app design system.
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Skeleton } from '@/components/ui/skeleton';
import {
  format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, differenceInDays, getYear, setYear,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import {
  CalendarPlus, UserPlus, Calendar, TrendingUp,
  Cake, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/* ─── Linear.app Design Tokens ─── */

const FONT = 'Inter, "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const DARK = {
  cardBg: '#0f1011',
  cardBgHover: '#141516',
  elevated: '#191a1b',
  text: '#f7f8f8',
  textSecondary: '#8a8f98',
  textTertiary: '#62666d',
  accent: '#5e6ad2',
  accentHover: '#828fff',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  border: 'rgba(255,255,255,0.05)',
  borderStrong: 'rgba(255,255,255,0.08)',
  stripBg: '#0c0d0e',
};

const LIGHT = {
  cardBg: '#ffffff',
  cardBgHover: '#f3f4f5',
  elevated: '#f3f4f5',
  text: '#0d0d0d',
  textSecondary: '#62666d',
  textTertiary: '#8a8f98',
  accent: '#5e6ad2',
  accentHover: '#4850b8',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  border: '#e6e6e6',
  borderStrong: '#d0d6e0',
  stripBg: '#f0f1f2',
};

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  service: { name: string; color: string } | null;
  client: { full_name: string } | null;
}

interface Expense {
  id: string;
  amount: number;
  date: string;
}

interface ClientBirthday {
  id: string;
  full_name: string;
  date_of_birth: string;
}

/* ─── Helpers ─── */

function parseWorkingHours(
  wh: Record<string, { start: string; end: string } | null> | null,
  day: Date,
): number {
  if (!wh) return 0;
  const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day.getDay()];
  const slot = wh[dow];
  if (!slot) return 0;
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);
  return Math.max(0, eh + em / 60 - sh - sm / 60);
}

function getGreeting(t: ReturnType<typeof useTranslations>) {
  const h = new Date().getHours();
  if (h < 12) return t('greetingMorning');
  if (h < 18) return t('greeting');
  return t('greetingEvening');
}

function nextBirthday(dob: string): Date {
  const now = new Date();
  const birth = new Date(dob);
  let next = setYear(birth, getYear(now));
  if (next < startOfDay(now)) next = setYear(birth, getYear(now) + 1);
  return next;
}

/* ─── Easing ─── */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 6 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.04, duration: 0.25, ease: EASE_OUT } as const,
});

/* ─── Component ─── */

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;
  const isDark = mounted && resolvedTheme === 'dark';

  const { master, loading: masterLoading } = useMaster();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [birthdays, setBirthdays] = useState<ClientBirthday[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Data fetch ── */
  useEffect(() => {
    if (masterLoading || !master?.id) {
      if (!masterLoading) setLoading(false);
      return;
    }
    const supabase = createClient();
    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekEnd = endOfWeek(addDays(now, 7), { weekStartsOn: 1 });

    Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name, color), client:clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', weekEnd.toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('expenses')
        .select('id, amount, date')
        .eq('master_id', master.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd')),
      supabase
        .from('clients')
        .select('id, full_name, date_of_birth')
        .eq('master_id', master.id)
        .not('date_of_birth', 'is', null),
    ]).then(([apptRes, expRes, clientRes]) => {
      setAppointments((apptRes.data as unknown as Appointment[]) || []);
      setExpenses((expRes.data as unknown as Expense[]) || []);
      setBirthdays((clientRes.data as unknown as ClientBirthday[]) || []);
      setLoading(false);
    });
  }, [master?.id, masterLoading]);

  /* ── Computed ── */
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const profit = useMemo(() => {
    let incomeToday = 0, incomeWeek = 0, incomeMonth = 0;
    let expToday = 0, expWeek = 0, expMonth = 0;

    for (const a of appointments) {
      if (a.status !== 'completed') continue;
      const d = new Date(a.starts_at);
      const p = Number(a.price) || 0;
      if (d >= todayStart && d <= todayEnd) incomeToday += p;
      if (d >= weekStart) incomeWeek += p;
      if (d >= monthStart) incomeMonth += p;
    }

    for (const e of expenses) {
      const d = new Date(e.date + 'T00:00:00');
      const a = Number(e.amount) || 0;
      if (d >= todayStart && d <= todayEnd) expToday += a;
      if (d >= weekStart) expWeek += a;
      if (d >= monthStart) expMonth += a;
    }

    return {
      today: { income: incomeToday, expense: expToday, net: incomeToday - expToday },
      week: { income: incomeWeek, expense: expWeek, net: incomeWeek - expWeek },
      month: { income: incomeMonth, expense: expMonth, net: incomeMonth - expMonth },
    };
  }, [appointments, expenses, todayStart, todayEnd, weekStart, monthStart]);

  const todaySchedule = useMemo(() =>
    appointments.filter(a => {
      const d = new Date(a.starts_at);
      return d >= todayStart && d <= todayEnd && a.status !== 'cancelled';
    }),
  [appointments, todayStart, todayEnd]);

  const upcomingBirthdays = useMemo(() => {
    return birthdays
      .map(c => {
        const next = nextBirthday(c.date_of_birth);
        const daysUntil = differenceInDays(startOfDay(next), todayStart);
        const age = getYear(next) - getYear(new Date(c.date_of_birth));
        return { ...c, next, daysUntil, age };
      })
      .filter(c => c.daysUntil >= 0 && c.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  }, [birthdays, todayStart]);

  const weekStats = useMemo(() => {
    let cancellations = 0, noShows = 0, totalWeek = 0;
    for (const a of appointments) {
      const d = new Date(a.starts_at);
      if (d < weekStart) continue;
      totalWeek++;
      if (a.status === 'cancelled') cancellations++;
      if (a.status === 'no_show') noShows++;
    }
    return { cancellations, noShows, totalWeek };
  }, [appointments, weekStart]);

  const utilization = useMemo(() => {
    const wh = master?.working_hours as Record<string, { start: string; end: string } | null> | null;
    const totalMins = parseWorkingHours(wh, now) * 60;
    if (totalMins <= 0) return 0;
    let bookedMins = 0;
    for (const a of todaySchedule) {
      const start = new Date(a.starts_at).getTime();
      const end = new Date(a.ends_at).getTime();
      bookedMins += Math.max(0, (end - start) / 60000);
    }
    return Math.min(100, Math.round((bookedMins / totalMins) * 100));
  }, [todaySchedule, master?.working_hours, now]);

  /* ── Currency ── */
  const fmtMoney = useCallback((n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ₴',
  [locale]);

  /* ── Card base style ── */
  const card: React.CSSProperties = {
    backgroundColor: C.cardBg,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    padding: 16,
    fontFamily: FONT,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  /* ── Loading skeleton ── */
  if (masterLoading || loading) {
    return (
      <div style={{ padding: '20px 24px', fontFamily: FONT, height: '100%' }}>
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="mb-4 h-16 rounded-[10px]" />
        <div className="grid grid-cols-3 gap-4" style={{ flex: 1 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-[10px]" />)}
        </div>
      </div>
    );
  }

  const firstName = master?.profile?.full_name?.split(' ')[0] || '';

  return (
    <div
      style={{
        fontFamily: FONT,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px 16px',
        gap: 16,
        overflow: 'hidden',
      }}
    >
      {/* ═══ Row 1: Greeting — compact single line ═══ */}
      <motion.div
        {...stagger(0)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexShrink: 0,
        }}
      >
        <h1 style={{
          fontSize: 20,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.3px',
          margin: 0,
        }}>
          {getGreeting(t)}, {firstName}
        </h1>
        <span style={{
          fontSize: 13,
          color: C.textTertiary,
          letterSpacing: '-0.1px',
          textTransform: 'capitalize',
        }}>
          {format(now, 'EEEE, d MMMM', { locale: dfLocale })}
        </span>
      </motion.div>

      {/* ═══ Row 2: Finance strip — compact horizontal bar ═══ */}
      <motion.div
        {...stagger(1)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          backgroundColor: C.stripBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {([
          { label: t('today'), data: profit.today },
          { label: t('thisWeek'), data: profit.week },
          { label: t('thisMonth'), data: profit.month },
        ] as const).map((item, i) => {
          const isPositive = item.data.net >= 0;
          return (
            <div
              key={item.label}
              style={{
                padding: '14px 20px',
                borderRight: i < 2 ? `1px solid ${C.border}` : undefined,
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 500,
                color: C.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 6,
              }}>
                {item.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.text,
                  letterSpacing: '-0.5px',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtMoney(item.data.net)}
                </span>
                {item.data.income > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 12,
                    fontWeight: 600,
                    color: isPositive ? C.success : C.danger,
                  }}>
                    {isPositive
                      ? <ArrowUpRight style={{ width: 12, height: 12 }} />
                      : <ArrowDownRight style={{ width: 12, height: 12 }} />
                    }
                    {fmtMoney(item.data.income)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ═══ Row 3: Three blocks — fills remaining space ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr 1fr',
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── Block 1: Today's Schedule ── */}
        <motion.div {...stagger(2)} style={{ ...card, minHeight: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock style={{ width: 14, height: 14, color: C.accent }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.2px' }}>
                {t('todaySchedule')}
              </span>
            </div>
            <Link
              href={`/${locale}/calendar`}
              style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 500 }}
            >
              {t('goToCalendar')} →
            </Link>
          </div>

          {todaySchedule.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <Calendar style={{ width: 28, height: 28, color: C.textTertiary, opacity: 0.5 }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, margin: 0, textAlign: 'center' }}>
                {t('noAppointmentsToday')}
              </p>
              <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>
                {t('freeDay')}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {todaySchedule.map((appt, i) => {
                const start = new Date(appt.starts_at);
                const end = new Date(appt.ends_at);
                const isPast = end < now;
                const isNow = start <= now && end > now;

                return (
                  <Link
                    key={appt.id}
                    href={`/${locale}/calendar`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 6px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      color: 'inherit',
                      opacity: isPast ? 0.45 : 1,
                      backgroundColor: isNow ? (isDark ? 'rgba(94,106,210,0.08)' : 'rgba(94,106,210,0.04)') : 'transparent',
                      borderBottom: i < todaySchedule.length - 1 ? `1px solid ${C.border}` : undefined,
                      transition: 'background-color 150ms cubic-bezier(0.23,1,0.32,1)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ minWidth: 40, textAlign: 'right' }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isNow ? C.accent : C.text,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {format(start, 'HH:mm')}
                      </div>
                    </div>
                    <div style={{
                      width: 3,
                      height: 28,
                      borderRadius: 2,
                      backgroundColor: appt.service?.color || C.accent,
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {appt.service?.name || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 1 }}>
                        {appt.client?.full_name || '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, flexShrink: 0 }}>
                      {fmtMoney(Number(appt.price) || 0)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Block 2: Stats + Quick Actions ── */}
        <motion.div {...stagger(3)} style={{ ...card, gap: 12, minHeight: 0 }}>
          {/* Utilization bar */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('occupancy')}
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.4px' }}>
                {utilization}%
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? '#191a1b' : '#e6e6e6' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${utilization}%` }}
                transition={{ delay: 0.4, duration: 0.5 }}
                style={{
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: utilization > 80 ? C.success : utilization > 40 ? C.accent : C.warning,
                }}
              />
            </div>
          </div>

          {/* Mini stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{
              padding: '8px 10px',
              borderRadius: 8,
              backgroundColor: isDark ? '#141516' : '#f5f6f7',
            }}>
              <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 2 }}>{t('todaySchedule')}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{todaySchedule.length}</div>
            </div>
            <div style={{
              padding: '8px 10px',
              borderRadius: 8,
              backgroundColor: isDark ? '#141516' : '#f5f6f7',
            }}>
              <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 2 }}>{t('thisWeek')}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{weekStats.totalWeek}</div>
            </div>
          </div>

          {/* Cancellations + no-shows compact */}
          {(weekStats.cancellations > 0 || weekStats.noShows > 0) && (
            <div style={{
              display: 'flex',
              gap: 12,
              fontSize: 12,
              color: C.textSecondary,
              flexShrink: 0,
            }}>
              {weekStats.cancellations > 0 && (
                <span style={{ color: C.warning }}>
                  {t('cancellations')}: {weekStats.cancellations}
                </span>
              )}
              {weekStats.noShows > 0 && (
                <span style={{ color: C.danger }}>
                  {t('noShows')}: {weekStats.noShows}
                </span>
              )}
            </div>
          )}

          {/* Separator */}
          <div style={{ height: 1, backgroundColor: C.border, flexShrink: 0 }} />

          {/* Quick Actions */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8, letterSpacing: '-0.1px' }}>
              {t('quickActions')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: `/${locale}/calendar`, icon: CalendarPlus, label: t('newAppointment'), accent: true },
                { href: `/${locale}/clients`, icon: UserPlus, label: t('addClient'), accent: false },
                { href: `/${locale}/finance`, icon: TrendingUp, label: t('goToFinance'), accent: false },
              ].map(({ href, icon: Icon, label, accent }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    backgroundColor: accent ? C.accent : (isDark ? '#141516' : '#f5f6f7'),
                    color: accent ? '#ffffff' : C.text,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)',
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                  <Icon style={{ width: 14, height: 14, opacity: 0.8 }} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Block 3: Birthdays ── */}
        <motion.div {...stagger(4)} style={{ ...card, minHeight: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            flexShrink: 0,
          }}>
            <Cake style={{ width: 14, height: 14, color: C.warning }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.2px' }}>
              {t('birthdays')}
            </span>
          </div>

          {upcomingBirthdays.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <p style={{ fontSize: 13, color: C.textTertiary, margin: 0, textAlign: 'center' }}>
                {t('noBirthdays')}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {upcomingBirthdays.map((client, i) => (
                <Link
                  key={client.id}
                  href={`/${locale}/clients/${client.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 4px',
                    borderBottom: i < upcomingBirthdays.length - 1 ? `1px solid ${C.border}` : undefined,
                    textDecoration: 'none',
                    color: 'inherit',
                    flexShrink: 0,
                    transition: 'background-color 150ms cubic-bezier(0.23,1,0.32,1)',
                    borderRadius: 4,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{client.full_name}</div>
                    <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>
                      {t('turnsAge', { age: client.age })}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: client.daysUntil === 0 ? C.warning : client.daysUntil === 1 ? C.accent : C.textSecondary,
                    padding: '2px 8px',
                    borderRadius: 6,
                    backgroundColor: client.daysUntil <= 1
                      ? (isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)')
                      : 'transparent',
                    whiteSpace: 'nowrap',
                  }}>
                    {client.daysUntil === 0
                      ? t('birthdayToday')
                      : client.daysUntil === 1
                        ? t('birthdayTomorrow')
                        : t('birthdayInDays', { n: client.daysUntil })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
