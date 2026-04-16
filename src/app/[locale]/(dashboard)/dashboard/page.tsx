/** --- YAML
 * name: Dashboard Overview
 * description: Master's operational dashboard — compact single-screen. Finance strip + 3-block grid (schedule, retention+actions, birthdays). Linear.app tokens.
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
  startOfMonth, endOfMonth, subMonths, subWeeks, subDays,
  differenceInDays, getYear, setYear,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import {
  CalendarPlus, UserPlus, Calendar, TrendingUp,
  Cake, Clock, ArrowUpRight, ArrowDownRight, Minus,
  UserCheck,
} from 'lucide-react';

/* ─── Tokens ─── */

const FONT = 'Inter, "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const DARK = {
  cardBg: '#0f1011',
  text: '#f7f8f8',
  textSecondary: '#8a8f98',
  textTertiary: '#62666d',
  accent: '#5e6ad2',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  border: 'rgba(255,255,255,0.05)',
  stripBg: '#0c0d0e',
  blockBg: '#141516',
};

const LIGHT = {
  cardBg: '#ffffff',
  text: '#0d0d0d',
  textSecondary: '#62666d',
  textTertiary: '#8a8f98',
  accent: '#5e6ad2',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  border: '#e6e6e6',
  stripBg: '#f0f1f2',
  blockBg: '#f5f6f7',
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

interface Expense { id: string; amount: number; date: string }
interface ClientBirthday { id: string; full_name: string; date_of_birth: string }
interface LostClient { id: string; full_name: string; last_visit_at: string; total_visits: number }

/* ─── Helpers ─── */

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

function pctChange(current: number, previous: number): { value: number; label: string } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { value: 100, label: '+100%' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { value: 0, label: 'Стабильно' };
  return { value: pct, label: (pct > 0 ? '+' : '') + pct + '%' };
}

/* ─── Easing ─── */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const stagger = (i: number) => ({
  initial: { opacity: 0, y: 6 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.04, duration: 0.25, ease: EASE_OUT } as const,
});

/* ─── Page ─── */

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
  const [lostClients, setLostClients] = useState<LostClient[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Fetch ── */
  useEffect(() => {
    if (masterLoading || !master?.id) {
      if (!masterLoading) setLoading(false);
      return;
    }
    const supabase = createClient();
    const now = new Date();
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const weekEnd = endOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    const thirtyDaysAgo = subDays(now, 30).toISOString();

    Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name, color), client:clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', prevMonthStart.toISOString())
        .lte('starts_at', weekEnd.toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('expenses')
        .select('id, amount, date')
        .eq('master_id', master.id)
        .gte('date', format(prevMonthStart, 'yyyy-MM-dd')),
      supabase
        .from('clients')
        .select('id, full_name, date_of_birth')
        .eq('master_id', master.id)
        .not('date_of_birth', 'is', null),
      // Clients who haven't visited in 30+ days but have visited at least once
      supabase
        .from('clients')
        .select('id, full_name, last_visit_at, total_visits')
        .eq('master_id', master.id)
        .not('last_visit_at', 'is', null)
        .lt('last_visit_at', thirtyDaysAgo)
        .gt('total_visits', 0)
        .order('last_visit_at', { ascending: false })
        .limit(8),
    ]).then(([apptRes, expRes, clientRes, lostRes]) => {
      setAppointments((apptRes.data as unknown as Appointment[]) || []);
      setExpenses((expRes.data as unknown as Expense[]) || []);
      setBirthdays((clientRes.data as unknown as ClientBirthday[]) || []);
      setLostClients((lostRes.data as unknown as LostClient[]) || []);
      setLoading(false);
    });
  }, [master?.id, masterLoading]);

  /* ── Computed ── */
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const profit = useMemo(() => {
    function sumPeriod(from: Date, to: Date) {
      let income = 0, expense = 0;
      for (const a of appointments) {
        if (a.status !== 'completed') continue;
        const d = new Date(a.starts_at);
        if (d >= from && d <= to) income += Number(a.price) || 0;
      }
      for (const e of expenses) {
        const d = new Date(e.date + 'T00:00:00');
        if (d >= from && d <= to) expense += Number(e.amount) || 0;
      }
      return income - expense;
    }
    return {
      today: { net: sumPeriod(todayStart, todayEnd), change: pctChange(sumPeriod(todayStart, todayEnd), sumPeriod(yesterdayStart, yesterdayEnd)) },
      week: { net: sumPeriod(weekStart, todayEnd), change: pctChange(sumPeriod(weekStart, todayEnd), sumPeriod(prevWeekStart, prevWeekEnd)) },
      month: { net: sumPeriod(monthStart, todayEnd), change: pctChange(sumPeriod(monthStart, todayEnd), sumPeriod(prevMonthStart, prevMonthEnd)) },
    };
  }, [appointments, expenses, todayStart, todayEnd, yesterdayStart, yesterdayEnd, weekStart, prevWeekStart, prevWeekEnd, monthStart, prevMonthStart, prevMonthEnd]);

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
      .slice(0, 6);
  }, [birthdays, todayStart]);

  /* ── Currency ── */
  const fmtMoney = useCallback((n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ₴',
  [locale]);

  /* ── Styles ── */
  const card: React.CSSProperties = {
    backgroundColor: C.cardBg,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    padding: 14,
    fontFamily: FONT,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  /* ── Loading ── */
  if (masterLoading || loading) {
    return (
      <div style={{ padding: '20px 24px', fontFamily: FONT, height: '100%' }}>
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="mb-4 h-20 rounded-[10px]" />
        <div className="grid grid-cols-3 gap-4" style={{ flex: 1 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-[10px]" />)}
        </div>
      </div>
    );
  }

  const firstName = master?.profile?.full_name?.split(' ')[0] || '';
  const monthName = format(now, 'LLLL', { locale: dfLocale });

  const financeItems = [
    { label: t('today').toUpperCase(), data: profit.today },
    { label: t('thisWeek').toUpperCase(), data: profit.week },
    { label: (monthName.charAt(0).toUpperCase() + monthName.slice(1)).toUpperCase(), data: profit.month },
  ];

  return (
    <div
      style={{
        fontFamily: FONT,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 24px 12px',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      {/* ═══ Row 1: Greeting ═══ */}
      <motion.div
        {...stagger(0)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text, letterSpacing: '-0.3px', margin: 0 }}>
          {getGreeting(t)}, {firstName}
        </h1>
        <span style={{ fontSize: 13, color: C.textTertiary, textTransform: 'capitalize' }}>
          {format(now, 'EEEE, d MMMM', { locale: dfLocale })}
        </span>
      </motion.div>

      {/* ═══ Row 2: Finance strip ═══ */}
      <motion.div
        {...stagger(1)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          backgroundColor: C.stripBg,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {financeItems.map((item, i) => {
          const ch = item.data.change;
          const changeColor = !ch ? C.textTertiary
            : ch.value > 0 ? C.success
            : ch.value < 0 ? C.danger
            : C.textSecondary;

          return (
            <div
              key={item.label}
              style={{
                padding: '14px 20px 12px',
                borderRight: i < 2 ? `1px solid ${C.border}` : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.6px' }}>
                  {item.label}
                </span>
                {ch && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    fontSize: 11, fontWeight: 600, color: changeColor,
                    backgroundColor: isDark
                      ? (ch.value > 0 ? 'rgba(16,185,129,0.12)' : ch.value < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)')
                      : (ch.value > 0 ? 'rgba(5,150,105,0.08)' : ch.value < 0 ? 'rgba(220,38,38,0.08)' : 'rgba(0,0,0,0.04)'),
                    padding: '2px 7px', borderRadius: 5,
                  }}>
                    {ch.value > 0 && <ArrowUpRight style={{ width: 10, height: 10 }} />}
                    {ch.value < 0 && <ArrowDownRight style={{ width: 10, height: 10 }} />}
                    {ch.value === 0 && <Minus style={{ width: 10, height: 10 }} />}
                    {ch.label}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {fmtMoney(item.data.net)}
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 3 }}>
                {t('netProfit')}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ═══ Row 3: Three blocks ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.6fr', gap: 12, flex: 1, minHeight: 0 }}>

        {/* ── Block 1: Today's Schedule ── */}
        <motion.div {...stagger(2)} style={{ ...card, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock style={{ width: 14, height: 14, color: C.accent }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t('todaySchedule')}</span>
              {todaySchedule.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: C.accent,
                  backgroundColor: isDark ? 'rgba(94,106,210,0.12)' : 'rgba(94,106,210,0.08)',
                  padding: '1px 7px', borderRadius: 5,
                }}>
                  {todaySchedule.length}
                </span>
              )}
            </div>
            <Link href={`/${locale}/calendar`} style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>
              {t('goToCalendar')} →
            </Link>
          </div>

          {todaySchedule.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Calendar style={{ width: 24, height: 24, color: C.textTertiary, opacity: 0.4 }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, margin: 0 }}>{t('noAppointmentsToday')}</p>
              <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>{t('freeDay')}</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 4px', borderRadius: 6, textDecoration: 'none', color: 'inherit',
                      opacity: isPast ? 0.4 : 1,
                      backgroundColor: isNow ? (isDark ? 'rgba(94,106,210,0.08)' : 'rgba(94,106,210,0.04)') : 'transparent',
                      borderBottom: i < todaySchedule.length - 1 ? `1px solid ${C.border}` : undefined,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ minWidth: 38, textAlign: 'right', fontSize: 13, fontWeight: 600, color: isNow ? C.accent : C.text, fontVariantNumeric: 'tabular-nums' }}>
                      {format(start, 'HH:mm')}
                    </div>
                    <div style={{ width: 3, height: 26, borderRadius: 2, backgroundColor: appt.service?.color || C.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appt.service?.name || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 1 }}>{appt.client?.full_name || '—'}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, flexShrink: 0 }}>{fmtMoney(Number(appt.price) || 0)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Block 2: Client Retention + Quick Actions ── */}
        <motion.div {...stagger(3)} style={{ ...card, gap: 0, minHeight: 0 }}>
          {/* Client retention */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
              <UserCheck style={{ width: 14, height: 14, color: C.warning }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t('clientRetention')}</span>
              {lostClients.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: C.warning,
                  backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
                  padding: '1px 7px', borderRadius: 5,
                }}>
                  {lostClients.length}
                </span>
              )}
            </div>

            {lostClients.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 12, color: C.textTertiary, margin: 0, textAlign: 'center' }}>
                  {t('noLostClients')}
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {lostClients.map((client, i) => {
                  const daysSince = differenceInDays(now, new Date(client.last_visit_at));
                  return (
                    <Link
                      key={client.id}
                      href={`/${locale}/clients/${client.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 2px', textDecoration: 'none', color: 'inherit',
                        borderBottom: i < lostClients.length - 1 ? `1px solid ${C.border}` : undefined,
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {client.full_name}
                        </div>
                        <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>
                          {t('totalVisits', { n: client.total_visits })}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                        color: daysSince > 60 ? C.danger : C.warning,
                      }}>
                        {daysSince} {t('daysAgo')}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separator + Quick Actions */}
          <div style={{ flexShrink: 0, marginTop: 8 }}>
            <div style={{ height: 1, backgroundColor: C.border, marginBottom: 8 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { href: `/${locale}/calendar`, icon: CalendarPlus, label: t('newAppointment'), accent: true },
                { href: `/${locale}/clients`, icon: UserPlus, label: t('addClient'), accent: false },
              ].map(({ href, icon: Icon, label, accent }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8,
                    backgroundColor: accent ? C.accent : C.blockBg,
                    color: accent ? '#ffffff' : C.text,
                    textDecoration: 'none', fontSize: 12, fontWeight: 500,
                    transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)',
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                  <Icon style={{ width: 13, height: 13, opacity: 0.8 }} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Block 3: Birthdays (narrow) ── */}
        <motion.div {...stagger(4)} style={{ ...card, minHeight: 0, padding: '14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0 }}>
            <Cake style={{ width: 13, height: 13, color: C.warning }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t('birthdays')}</span>
          </div>

          {upcomingBirthdays.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 12, color: C.textTertiary, margin: 0, textAlign: 'center' }}>{t('noBirthdays')}</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {upcomingBirthdays.map((client, i) => (
                <Link
                  key={client.id}
                  href={`/${locale}/clients/${client.id}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 1,
                    padding: '6px 2px', textDecoration: 'none', color: 'inherit',
                    borderBottom: i < upcomingBirthdays.length - 1 ? `1px solid ${C.border}` : undefined,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.full_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.textTertiary }}>{t('turnsAge', { age: client.age })}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: client.daysUntil === 0 ? C.warning : client.daysUntil === 1 ? C.accent : C.textSecondary,
                    }}>
                      {client.daysUntil === 0
                        ? t('birthdayToday')
                        : client.daysUntil === 1
                          ? t('birthdayTomorrow')
                          : t('birthdayInDays', { n: client.daysUntil })}
                    </span>
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
