/** --- YAML
 * name: Dashboard Overview
 * description: Master's operational dashboard — FINCHECK-style structure. 4 gradient KPI cards + revenue chart + expense donut + appointments + birthdays.
 * created: 2026-04-13
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { FONT, FONT_FEATURES, CURRENCY, KPI_GRADIENTS, usePageTheme, pageContainer } from '@/lib/dashboard-theme';
import { Skeleton } from '@/components/ui/skeleton';
import {
  format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subMonths, subWeeks, subDays,
  differenceInDays, getYear, setYear, eachDayOfInterval,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import {
  Cake, Clock, ArrowUpRight, ArrowDownRight, Minus,
  Bell, Check, Mic, Calendar as CalendarIcon,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { BreakdownDonut } from '@/components/ui/breakdown-donut';

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

interface Expense { id: string; amount: number; date: string; category: string | null }
interface ClientBirthday { id: string; full_name: string; date_of_birth: string }
interface Reminder { id: string; text: string; due_at: string | null; source: string; created_at: string }

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
  // No basis for comparison — caller will hide the badge entirely
  if (previous === 0) return null;
  if (current === previous) return { value: 0, label: 'Без изменений' };
  // Use |previous| to preserve sign of change when previous is negative
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return { value: pct, label: (pct > 0 ? '+' : '') + pct + '%' };
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const stagger = (i: number) => ({
  initial: { opacity: 0, y: 8 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.05, duration: 0.3, ease: EASE_OUT } as const,
});

/* ─── Mini SVG area chart ─── */
function AreaChart({ data, color, height = 180, width = 600 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const padding = 12;
  const chartH = height - padding * 2;
  const chartW = width - padding * 2;
  const stepX = chartW / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + chartH - (v / max) * chartH;
    return [x, y];
  });
  // Smooth path via cubic bezier
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const midX = (x1 + x2) / 2;
    path += ` C ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  }
  const areaPath = `${path} L ${points[points.length - 1][0]} ${height - padding} L ${padding} ${height - padding} Z`;

  const gradId = `grad-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Mini donut chart ─── */
interface DonutSlice { label: string; value: number; color: string }
function DonutChart({ slices, size = 140, strokeWidth = 22 }: { slices: DonutSlice[]; size?: number; strokeWidth?: number }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth={strokeWidth} />
      {slices.map((sl, i) => {
        const frac = sl.value / total;
        const dash = frac * circumference;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={sl.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { C, isDark } = usePageTheme();

  const { master, loading: masterLoading } = useMaster();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [birthdays, setBirthdays] = useState<ClientBirthday[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const weekEnd = endOfWeek(addDays(now, 7), { weekStartsOn: 1 });

    const [apptRes, expRes, clientRes, remRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name, color), client:clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', prevMonthStart.toISOString())
        .lte('starts_at', weekEnd.toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('expenses')
        .select('id, amount, date, category')
        .eq('master_id', master.id)
        .gte('date', format(prevMonthStart, 'yyyy-MM-dd')),
      supabase
        .from('clients')
        .select('id, full_name, date_of_birth')
        .eq('master_id', master.id)
        .not('date_of_birth', 'is', null),
      supabase
        .from('reminders')
        .select('id, text, due_at, source, created_at')
        .eq('master_id', master.id)
        .eq('completed', false)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(6),
    ]);
    setAppointments((apptRes.data as unknown as Appointment[]) || []);
    setExpenses((expRes.data as unknown as Expense[]) || []);
    setBirthdays((clientRes.data as unknown as ClientBirthday[]) || []);
    setReminders((remRes.data as unknown as Reminder[]) || []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (masterLoading) return;
    if (!master?.id) { setLoading(false); return; }
    fetchDashboard();
  }, [master?.id, masterLoading, fetchDashboard]);

  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `master_id=eq.${master.id}` }, () => { fetchDashboard(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [master?.id, fetchDashboard]);

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

  const sumRevenue = useCallback((from: Date, to: Date) => {
    let s = 0;
    for (const a of appointments) {
      if (a.status !== 'completed') continue;
      const d = new Date(a.starts_at);
      if (d >= from && d <= to) s += Number(a.price) || 0;
    }
    return s;
  }, [appointments]);

  const sumExpenses = useCallback((from: Date, to: Date) => {
    let s = 0;
    for (const e of expenses) {
      const d = new Date(e.date + 'T00:00:00');
      if (d >= from && d <= to) s += Number(e.amount) || 0;
    }
    return s;
  }, [expenses]);

  const kpi = useMemo(() => {
    const todayRev = sumRevenue(todayStart, todayEnd);
    const yestRev = sumRevenue(yesterdayStart, yesterdayEnd);
    const weekRev = sumRevenue(weekStart, todayEnd);
    const prevWeekRev = sumRevenue(prevWeekStart, prevWeekEnd);
    const monthRev = sumRevenue(monthStart, todayEnd);
    const prevMonthRev = sumRevenue(prevMonthStart, prevMonthEnd);
    const monthExp = sumExpenses(monthStart, todayEnd);
    const prevMonthExp = sumExpenses(prevMonthStart, prevMonthEnd);
    const net = monthRev - monthExp;
    const prevNet = prevMonthRev - prevMonthExp;
    return {
      today:  { value: todayRev, change: pctChange(todayRev, yestRev) },
      week:   { value: weekRev, change: pctChange(weekRev, prevWeekRev) },
      month:  { value: monthRev, change: pctChange(monthRev, prevMonthRev) },
      net:    { value: net, change: pctChange(net, prevNet) },
    };
  }, [sumRevenue, sumExpenses, todayStart, todayEnd, yesterdayStart, yesterdayEnd, weekStart, prevWeekStart, prevWeekEnd, monthStart, prevMonthStart, prevMonthEnd]);

  /* Revenue chart — last 30 days */
  const revenueSeries = useMemo(() => {
    const from = subDays(todayStart, 29);
    const days = eachDayOfInterval({ start: from, end: todayEnd });
    return days.map(d => sumRevenue(startOfDay(d), endOfDay(d)));
  }, [sumRevenue, todayStart, todayEnd]);

  /* Expense chart — last 30 days */
  const expenseSeries = useMemo(() => {
    const from = subDays(todayStart, 29);
    const days = eachDayOfInterval({ start: from, end: todayEnd });
    return days.map(d => sumExpenses(startOfDay(d), endOfDay(d)));
  }, [sumExpenses, todayStart, todayEnd]);

  const PALETTE = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e'];

  /* Expense breakdown by category — current month */
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const d = new Date(e.date + 'T00:00:00');
      if (d < monthStart || d > todayEnd) continue;
      let cat = e.category || 'Прочее';
      // Translate legacy voice-action 'other' to readable RU
      if (cat === 'other' || cat === 'Other' || cat === 'revenue_voice') cat = 'Прочее';
      map.set(cat, (map.get(cat) || 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [expenses, monthStart, todayEnd]);

  /* Revenue breakdown BY SERVICE — current month */
  const revenueByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      if (a.status !== 'completed') continue;
      const d = new Date(a.starts_at);
      if (d < monthStart || d > todayEnd) continue;
      const name = a.service?.name || 'Без услуги';
      map.set(name, (map.get(name) || 0) + (Number(a.price) || 0));
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
  }, [appointments, monthStart, todayEnd]);

  const todaySchedule = useMemo(() =>
    appointments.filter(a => {
      const d = new Date(a.starts_at);
      return d >= todayStart && d <= todayEnd && a.status !== 'cancelled';
    }).slice(0, 6),
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

  const fmtMoney = useCallback((n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ' + CURRENCY,
  [locale]);

  const completeReminder = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from('reminders').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  /* ── Loading ── */
  if (masterLoading || loading) {
    return (
      <div style={{ ...pageContainer, background: C.bg, minHeight: '100%' }}>
        <Skeleton className="mb-6 h-6 w-64" />
        <div className="mb-6 grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="mb-5 grid grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-2xl col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const firstName = master?.profile?.full_name?.split(' ')[0] || '';
  const totalMonthExp = expenseByCategory.reduce((s, sl) => s + sl.value, 0);

  const kpiCards = [
    { label: 'Сегодня',        value: kpi.today.value, change: kpi.today.change, gradient: KPI_GRADIENTS.revenue,  subtitle: t('netProfit') },
    { label: 'Эта неделя',      value: kpi.week.value,  change: kpi.week.change,  gradient: KPI_GRADIENTS.profit,   subtitle: t('netProfit') },
    { label: 'Этот месяц',      value: kpi.month.value, change: kpi.month.change, gradient: KPI_GRADIENTS.neutral,  subtitle: 'доход' },
    { label: 'Чистая прибыль',  value: kpi.net.value,   change: kpi.net.change,   gradient: KPI_GRADIENTS.expenses, subtitle: 'за месяц' },
  ];

  const cardBase: React.CSSProperties = {
    background: C.surface,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: 22,
    fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{
      ...pageContainer,
      color: C.text,
      background: C.bg,
      minHeight: '100%',
      paddingBottom: 96, // breathing room at bottom, no cut-off feel
    }}>
      {/* ═══ Row 1: Greeting + date ═══ */}
      <motion.div
        {...stagger(0)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>
            {getGreeting(t)}, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: C.textTertiary, margin: '4px 0 0', textTransform: 'capitalize' }}>
            {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
          </p>
        </div>
      </motion.div>

      {/* ═══ Row 2: 4 KPI gradient cards ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        {kpiCards.map((card, i) => {
          const ch = card.change;
          return (
            <motion.div
              key={card.label}
              {...stagger(i + 1)}
              style={{
                background: card.gradient,
                borderRadius: 18,
                padding: '22px 24px',
                position: 'relative',
                overflow: 'hidden',
                color: '#ffffff',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(124,58,237,0.1)',
              }}
            >
              {/* Decorative */}
              <div style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ position: 'absolute', right: 18, bottom: -32, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(card.value)}
                <span style={{ fontSize: 16, fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>{CURRENCY}</span>
              </div>
              {ch && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,255,255,0.22)',
                  padding: '3px 9px', borderRadius: 6,
                }}>
                  {ch.value > 0 && <ArrowUpRight size={11} />}
                  {ch.value < 0 && <ArrowDownRight size={11} />}
                  {ch.value === 0 && <Minus size={11} />}
                  {ch.label}
                  <span style={{ opacity: 0.65, fontWeight: 400 }}>· {card.subtitle}</span>
                </div>
              )}
              {!ch && (
                <div style={{ fontSize: 11, opacity: 0.7 }}>{card.subtitle}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ═══ Row 3: Appointments table (wide) + Birthdays/Reminders (narrow) — promoted above money blocks per product feedback ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Today's appointments */}
        <motion.div {...stagger(7)} style={cardBase}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} style={{ color: C.accent }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{t('todaySchedule')}</h3>
              {todaySchedule.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: C.accent,
                  background: C.accentSoft, padding: '2px 8px', borderRadius: 6,
                }}>
                  {todaySchedule.length}
                </span>
              )}
            </div>
            <Link href={`/${locale}/calendar`} style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
              {t('goToCalendar')} →
            </Link>
          </div>

          {todaySchedule.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0' }}>
              <CalendarIcon size={28} style={{ color: C.textTertiary, opacity: 0.35 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary, margin: 0 }}>{t('noAppointmentsToday')}</p>
              <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>{t('freeDay')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '70px 3px 1fr 1fr 100px',
                minWidth: 520,
                padding: '8px 4px', gap: 10,
                fontSize: 11, fontWeight: 600, color: C.textTertiary,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span>Время</span>
                <span />
                <span>Услуга</span>
                <span>Клиент</span>
                <span style={{ textAlign: 'right' }}>Сумма</span>
              </div>
              {todaySchedule.map((appt) => {
                const start = new Date(appt.starts_at);
                const end = new Date(appt.ends_at);
                const isPast = end < now;
                const isNow = start <= now && end > now;
                return (
                  <Link
                    key={appt.id}
                    href={`/${locale}/calendar`}
                    style={{
                      display: 'grid', gridTemplateColumns: '70px 3px 1fr 1fr 100px',
                      minWidth: 520,
                      padding: '12px 4px', gap: 10, alignItems: 'center',
                      textDecoration: 'none', color: 'inherit',
                      borderBottom: `1px solid ${C.border}`,
                      background: isNow ? C.accentSoft : 'transparent',
                      opacity: isPast ? 0.5 : 1,
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: isNow ? C.accent : C.text, fontVariantNumeric: 'tabular-nums' }}>
                      {format(start, 'HH:mm')}
                    </span>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: appt.service?.color || C.accent }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appt.service?.name || '—'}
                    </span>
                    <span style={{ fontSize: 13, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appt.client?.full_name || '—'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(Number(appt.price) || 0)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Birthdays + Reminders */}
        <motion.div {...stagger(8)} style={cardBase}>
          {/* Birthdays header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Cake size={15} style={{ color: C.warning }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{t('birthdays')}</h3>
          </div>

          {upcomingBirthdays.length === 0 ? (
            <div style={{ padding: '12px 0', textAlign: 'center', color: C.textTertiary, fontSize: 13 }}>
              {t('noBirthdays')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: reminders.length > 0 ? 16 : 0 }}>
              {upcomingBirthdays.map((client, i) => (
                <Link
                  key={client.id}
                  href={`/${locale}/clients/${client.id}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', textDecoration: 'none', color: 'inherit',
                    borderBottom: i < upcomingBirthdays.length - 1 ? `1px solid ${C.border}` : undefined,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.full_name}
                    </div>
                    <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
                      {t('turnsAge', { age: client.age })}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, flexShrink: 0,
                    padding: '3px 8px', borderRadius: 6,
                    color: client.daysUntil === 0 ? '#fff' : client.daysUntil <= 1 ? C.accent : C.textSecondary,
                    background: client.daysUntil === 0 ? C.warning : client.daysUntil <= 1 ? C.accentSoft : 'transparent',
                  }}>
                    {client.daysUntil === 0
                      ? t('birthdayToday')
                      : client.daysUntil === 1
                        ? t('birthdayTomorrow')
                        : t('birthdayInDays', { n: client.daysUntil })}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Reminders */}
          {reminders.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <Bell size={15} style={{ color: C.accent }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{t('remindersTitle')}</h3>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: C.accent,
                  background: C.accentSoft, padding: '1px 7px', borderRadius: 5,
                }}>
                  {reminders.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {reminders.slice(0, 4).map((rem, i) => (
                  <div
                    key={rem.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 0',
                      borderBottom: i < Math.min(reminders.length, 4) - 1 ? `1px solid ${C.border}` : undefined,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => completeReminder(rem.id)}
                      style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                        border: `1.5px solid ${C.borderStrong}`,
                        background: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Check size={10} style={{ color: C.success, opacity: 0 }} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text, lineHeight: 1.4 }}>
                        {rem.text}
                      </div>
                      {rem.due_at && (
                        <div style={{ fontSize: 10, color: C.textTertiary, marginTop: 2 }}>
                          {format(new Date(rem.due_at), 'd MMM, HH:mm', { locale: dfLocale })}
                        </div>
                      )}
                    </div>
                    {rem.source === 'voice' && (
                      <Mic size={10} style={{ color: C.textTertiary, flexShrink: 0, marginTop: 3 }} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ═══ Row 4: Income combo | Expense combo (2 equal columns, each has dynamics + structure stacked) — moved below schedule ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Income combo */}
        <motion.div {...stagger(5)} style={{ ...cardBase, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={15} style={{ color: C.success }} />
                <h3 style={{ fontSize: 15, fontWeight: 650, color: C.text, margin: 0 }}>Доходы</h3>
              </div>
              <div style={{
                padding: '4px 10px', borderRadius: 7,
                background: C.successSoft, color: C.success,
                fontSize: 12, fontWeight: 600,
              }}>
                {fmtMoney(kpi.month.value)}
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.textTertiary, margin: '2px 0 0' }}>
              Последние 30 дней · структура по услугам
            </p>
          </div>
          <div style={{ padding: '0 22px 8px' }}>
            <AreaChart data={revenueSeries} color={C.success} height={100} />
          </div>
          <div style={{ padding: '0 22px 18px', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <BreakdownDonut
              title=""
              slices={revenueByService}
              emptyText="Пока нет завершённых записей"
              C={C}
              isDark={isDark}
            />
          </div>
        </motion.div>

        {/* Expense combo */}
        <motion.div {...stagger(6)} style={{ ...cardBase, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingDown size={15} style={{ color: C.danger }} />
                <h3 style={{ fontSize: 15, fontWeight: 650, color: C.text, margin: 0 }}>Расходы</h3>
              </div>
              <div style={{
                padding: '4px 10px', borderRadius: 7,
                background: C.dangerSoft, color: C.danger,
                fontSize: 12, fontWeight: 600,
              }}>
                {fmtMoney(totalMonthExp)}
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.textTertiary, margin: '2px 0 0' }}>
              Последние 30 дней · структура по категориям
            </p>
          </div>
          <div style={{ padding: '0 22px 8px' }}>
            <AreaChart data={expenseSeries} color={C.danger} height={100} />
          </div>
          <div style={{ padding: '0 22px 18px', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <BreakdownDonut
              title=""
              slices={expenseByCategory}
              emptyText="Пока нет расходов"
              C={C}
              isDark={isDark}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
