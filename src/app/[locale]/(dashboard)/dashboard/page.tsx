/** --- YAML
 * name: Dashboard Overview
 * description: Master's operational dashboard — net profit, today's schedule, week view, client birthdays, quick actions. Linear.app design system.
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
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { TelegramLinkCard } from '@/components/dashboard/telegram-link-card';
import {
  format, subDays, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, differenceInDays, getYear, setYear, isToday, isTomorrow,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import {
  CalendarPlus, UserPlus, Calendar, ArrowUpRight, ArrowDownRight,
  TrendingUp, Cake, Clock, XCircle, UserX,
} from 'lucide-react';

/* ─── Linear.app Design Tokens ─── */

const FONT = 'Inter, "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const DARK = {
  pageBg: '#08090a',
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
};

const LIGHT = {
  pageBg: '#f7f8f8',
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
      // Appointments: from month start to week end (for revenue + schedule)
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name, color), client:clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', weekEnd.toISOString())
        .order('starts_at', { ascending: true }),
      // Expenses: current month
      supabase
        .from('expenses')
        .select('id, amount, date')
        .eq('master_id', master.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd')),
      // Clients with birthdays
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

  const weekSchedule = useMemo(() => {
    const days: { date: Date; appointments: Appointment[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(now, i + 1);
      const ds = startOfDay(day);
      const de = endOfDay(day);
      const dayAppts = appointments.filter(a => {
        const d = new Date(a.starts_at);
        return d >= ds && d <= de && a.status !== 'cancelled';
      });
      if (dayAppts.length > 0) days.push({ date: day, appointments: dayAppts });
    }
    return days;
  }, [appointments, now]);

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
      .slice(0, 6);
  }, [birthdays, todayStart]);

  const weekStats = useMemo(() => {
    let cancellations = 0, noShows = 0;
    for (const a of appointments) {
      const d = new Date(a.starts_at);
      if (d < weekStart) continue;
      if (a.status === 'cancelled') cancellations++;
      if (a.status === 'no_show') noShows++;
    }
    return { cancellations, noShows };
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

  /* ── Styles ── */
  const card: React.CSSProperties = {
    backgroundColor: C.cardBg,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    padding: 20,
    fontFamily: FONT,
  };

  /* Custom ease-out: starts fast, decelerates naturally (Emil Kowalski) */
  const EASE_OUT = [0.23, 1, 0.32, 1] as const;

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 8 } as const,
    animate: { opacity: 1, y: 0 } as const,
    transition: { delay: i * 0.04, duration: 0.3, ease: EASE_OUT } as const,
  });

  /* ── Loading ── */
  if (masterLoading || loading) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 1120, margin: '0 auto', fontFamily: FONT }}>
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-[10px]" />)}
        </div>
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="col-span-3 h-80 rounded-[10px]" />
          <Skeleton className="col-span-2 h-80 rounded-[10px]" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, backgroundColor: C.pageBg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 36px 80px' }}>

        {/* ═══ Greeting ═══ */}
        <motion.div {...stagger(0)} style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 600,
            color: C.text,
            letterSpacing: '-0.4px',
            lineHeight: '32px',
            margin: 0,
          }}>
            {getGreeting(t)}, {master?.profile?.full_name?.split(' ')[0] || ''}
          </h1>
          <p style={{
            fontSize: 14,
            color: C.textSecondary,
            marginTop: 4,
            letterSpacing: '-0.1px',
          }}>
            {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
          </p>
        </motion.div>

        {/* ═══ Onboarding + Telegram ═══ */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <OnboardingChecklist master={master} theme={isDark ? 'dark' : 'light'} />
          <TelegramLinkCard theme={isDark ? 'dark' : 'light'} />
        </div>

        {/* ═══ Net Profit — 3 cards ═══ */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {([
            { label: t('today'), data: profit.today },
            { label: t('thisWeek'), data: profit.week },
            { label: t('thisMonth'), data: profit.month },
          ] as const).map((item, i) => (
            <motion.div key={item.label} {...stagger(i + 1)} style={card}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                {t('netProfit')} · {item.label}
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: item.data.net >= 0 ? C.success : C.danger,
                letterSpacing: '-0.8px',
                lineHeight: '36px',
              }}>
                {item.data.net >= 0 ? '+' : ''}{fmtMoney(item.data.net)}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpRight style={{ width: 13, height: 13, color: C.success }} />
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{fmtMoney(item.data.income)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowDownRight style={{ width: 13, height: 13, color: C.danger }} />
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{fmtMoney(item.data.expense)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ═══ Utilization + Week Stats (compact row) ═══ */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Utilization */}
          <motion.div {...stagger(4)} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              {t('occupancy')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.5px' }}>{utilization}%</span>
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, backgroundColor: isDark ? '#191a1b' : '#e6e6e6' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${utilization}%` }}
                transition={{ delay: 0.5, duration: 0.6 }}
                style={{
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: utilization > 80 ? C.success : utilization > 40 ? C.accent : C.warning,
                }}
              />
            </div>
          </motion.div>

          {/* Today's visits count */}
          <motion.div {...stagger(5)} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              {t('todaySchedule')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.5px' }}>
              {todaySchedule.length}
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{t('todayAppointments')}</div>
          </motion.div>

          {/* Cancellations */}
          <motion.div {...stagger(6)} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <XCircle style={{ width: 12, height: 12, color: C.warning }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('cancellations')}
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: weekStats.cancellations > 0 ? C.warning : C.text, letterSpacing: '-0.5px' }}>
              {weekStats.cancellations}
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{t('thisWeekStats')}</div>
          </motion.div>

          {/* No-shows */}
          <motion.div {...stagger(7)} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <UserX style={{ width: 12, height: 12, color: C.danger }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('noShows')}
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: weekStats.noShows > 0 ? C.danger : C.text, letterSpacing: '-0.5px' }}>
              {weekStats.noShows}
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{t('thisWeekStats')}</div>
          </motion.div>
        </div>

        {/* ═══ Main content — 3+2 grid ═══ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

          {/* ── Left: Today's Schedule ── */}
          <motion.div {...stagger(8)} className="lg:col-span-3" style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock style={{ width: 16, height: 16, color: C.accent }} />
                <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.2px' }}>
                  {t('todaySchedule')}
                </h2>
              </div>
              <Link
                href={`/${locale}/calendar`}
                style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontWeight: 500 }}
              >
                {t('goToCalendar')} →
              </Link>
            </div>

            {todaySchedule.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Calendar style={{ width: 32, height: 32, color: C.textTertiary, margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary, margin: 0 }}>
                  {t('noAppointmentsToday')}
                </p>
                <p style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
                  {t('freeDay')}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {todaySchedule.map((appt, i) => {
                  const start = new Date(appt.starts_at);
                  const end = new Date(appt.ends_at);
                  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                  const isPast = end < now;
                  const isNow = start <= now && end > now;

                  return (
                    <Link
                      key={appt.id}
                      href={`/${locale}/calendar`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 8px',
                        borderRadius: 8,
                        textDecoration: 'none',
                        color: 'inherit',
                        opacity: isPast ? 0.5 : 1,
                        backgroundColor: isNow ? (isDark ? 'rgba(94,106,210,0.08)' : 'rgba(94,106,210,0.05)') : 'transparent',
                        borderBottom: i < todaySchedule.length - 1 ? `1px solid ${C.border}` : undefined,
                        transition: 'background-color 150ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)',
                      }}
                    >
                      {/* Time */}
                      <div style={{ minWidth: 48, textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isNow ? C.accent : C.text, fontVariantNumeric: 'tabular-nums' }}>
                          {format(start, 'HH:mm')}
                        </div>
                        <div style={{ fontSize: 11, color: C.textTertiary }}>{mins} мин</div>
                      </div>
                      {/* Color bar */}
                      <div style={{
                        width: 3,
                        height: 36,
                        borderRadius: 2,
                        backgroundColor: appt.service?.color || C.accent,
                        flexShrink: 0,
                      }} />
                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {appt.service?.name || '—'}
                        </div>
                        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 1 }}>
                          {appt.client?.full_name || '—'}
                        </div>
                      </div>
                      {/* Price */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, flexShrink: 0 }}>
                        {fmtMoney(Number(appt.price) || 0)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── Right column ── */}
          <div className="flex flex-col gap-6 lg:col-span-2">

            {/* Quick Actions */}
            <motion.div {...stagger(9)} style={card}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 14px', letterSpacing: '-0.2px' }}>
                {t('quickActions')}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: `/${locale}/calendar`, icon: CalendarPlus, label: t('newAppointment'), accent: true },
                  { href: `/${locale}/clients`, icon: UserPlus, label: t('addClient'), accent: false },
                  { href: `/${locale}/calendar`, icon: Calendar, label: t('goToCalendar'), accent: false },
                  { href: `/${locale}/finance`, icon: TrendingUp, label: t('goToFinance'), accent: false },
                ].map(({ href, icon: Icon, label, accent }) => (
                  <Link
                    key={label}
                    href={href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: accent ? C.accent : (isDark ? '#141516' : '#f3f4f5'),
                      color: accent ? '#ffffff' : C.text,
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 500,
                      transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1), opacity 0.15s',
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    <Icon style={{ width: 15, height: 15, opacity: 0.8 }} />
                    {label}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Birthdays */}
            <motion.div {...stagger(10)} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Cake style={{ width: 15, height: 15, color: C.warning }} />
                <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.2px' }}>
                  {t('birthdays')}
                </h2>
              </div>

              {upcomingBirthdays.length === 0 ? (
                <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>{t('noBirthdays')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {upcomingBirthdays.map((client, i) => (
                    <Link
                      key={client.id}
                      href={`/${locale}/clients/${client.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 4px',
                        borderBottom: i < upcomingBirthdays.length - 1 ? `1px solid ${C.border}` : undefined,
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{client.full_name}</div>
                        <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                          {t('turnsAge', { age: client.age })}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: client.daysUntil === 0 ? C.warning : client.daysUntil === 1 ? C.accent : C.textSecondary,
                        padding: '3px 8px',
                        borderRadius: 6,
                        backgroundColor: client.daysUntil <= 1 ? (isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)') : 'transparent',
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

        {/* ═══ Week overview ═══ */}
        <motion.div {...stagger(11)} style={{ ...card, marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.2px' }}>
              {t('weekSchedule')}
            </h2>
            <Link
              href={`/${locale}/calendar`}
              style={{ fontSize: 13, color: C.accent, textDecoration: 'none', fontWeight: 500 }}
            >
              {t('viewAll')} →
            </Link>
          </div>

          {weekSchedule.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textTertiary, margin: 0, padding: '20px 0', textAlign: 'center' }}>
              {t('emptyScheduleDesc')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {weekSchedule.map(day => (
                <div
                  key={day.date.toISOString()}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    backgroundColor: isDark ? '#141516' : '#f5f6f7',
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 8,
                    textTransform: 'capitalize',
                  }}>
                    {format(day.date, 'EEEE, d MMM', { locale: dfLocale })}
                  </div>
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 500, marginBottom: 8 }}>
                    {day.appointments.length === 1
                      ? t('oneAppointment')
                      : t('nAppointments', { n: day.appointments.length })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {day.appointments.slice(0, 4).map(appt => (
                      <div key={appt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.textSecondary, fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>
                          {format(new Date(appt.starts_at), 'HH:mm')}
                        </span>
                        <span style={{
                          width: 2,
                          height: 14,
                          borderRadius: 1,
                          backgroundColor: appt.service?.color || C.accent,
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {appt.client?.full_name || appt.service?.name || '—'}
                        </span>
                      </div>
                    ))}
                    {day.appointments.length > 4 && (
                      <span style={{ fontSize: 11, color: C.textTertiary }}>
                        +{day.appointments.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
