/** --- YAML
 * name: Today Page
 * description: Мастер-сводка на сегодня — flat StatCards (записи/выручка/неделя), список записей дня (AppointmentCard), rule-based блок подсказок (ДР, простой график, overdue reminders). Заменяет FINCHECK `/dashboard` с KPI_GRADIENTS.
 * created: 2026-04-19
 * updated: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { format, startOfDay, endOfDay, startOfWeek, differenceInDays, getYear, setYear, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import { Calendar as CalendarIcon, Coins, Users, Cake, Mic, Sparkles, ArrowRight, PartyPopper, Bell } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { StatCard } from '@/components/shared/primitives/stat-card';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { AppointmentCard, type AppointmentStatus } from '@/components/shared/appointment-card';
import { CURRENCY } from '@/lib/dashboard-theme';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number | null;
  service: { name: string } | null;
  client: { full_name: string } | null;
}

interface ClientBirthday {
  id: string;
  full_name: string;
  date_of_birth: string;
}

interface Reminder {
  id: string;
  text: string;
  due_at: string | null;
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

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 8 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] as const },
});

export default function TodayPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;

  const { master, loading: masterLoading } = useMaster();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [birthdays, setBirthdays] = useState<ClientBirthday[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfDay(now);

    const [apptRes, clientRes, remRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name), client:clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', weekStart.toISOString())
        .lte('starts_at', weekEnd.toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('clients')
        .select('id, full_name, date_of_birth')
        .eq('master_id', master.id)
        .not('date_of_birth', 'is', null),
      supabase
        .from('reminders')
        .select('id, text, due_at')
        .eq('master_id', master.id)
        .eq('completed', false)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(5),
    ]);

    setAppointments((apptRes.data as unknown as Appointment[]) || []);
    setBirthdays((clientRes.data as unknown as ClientBirthday[]) || []);
    setReminders((remRes.data as unknown as Reminder[]) || []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (masterLoading) return;
    if (!master?.id) { setLoading(false); return; }
    fetchToday();
  }, [master?.id, masterLoading, fetchToday]);

  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`today_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `master_id=eq.${master.id}` }, () => { fetchToday(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [master?.id, fetchToday]);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const todayAppts = useMemo(
    () => appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return d >= todayStart && d <= todayEnd && a.status !== 'cancelled';
    }),
    [appointments, todayStart, todayEnd],
  );

  const todayRevenue = useMemo(
    () => appointments.reduce((s, a) => {
      if (a.status !== 'completed') return s;
      const d = new Date(a.starts_at);
      if (d < todayStart || d > todayEnd) return s;
      return s + (Number(a.price) || 0);
    }, 0),
    [appointments, todayStart, todayEnd],
  );

  const weekRevenue = useMemo(
    () => appointments.reduce((s, a) => {
      if (a.status !== 'completed') return s;
      const d = new Date(a.starts_at);
      if (d < weekStart || d > todayEnd) return s;
      return s + (Number(a.price) || 0);
    }, 0),
    [appointments, weekStart, todayEnd],
  );

  const upcomingBirthdays = useMemo(() => {
    return birthdays
      .map((c) => {
        const next = nextBirthday(c.date_of_birth);
        const daysUntil = differenceInDays(startOfDay(next), todayStart);
        return { ...c, daysUntil };
      })
      .filter((c) => c.daysUntil >= 0 && c.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3);
  }, [birthdays, todayStart]);

  const overdueReminders = useMemo(() => {
    return reminders.filter((r) => r.due_at && new Date(r.due_at) < now).slice(0, 3);
  }, [reminders, now]);

  const firstName = master?.profile?.first_name || master?.profile?.full_name?.split(' ')[0] || '';
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ' + CURRENCY;

  if (masterLoading || loading) {
    return (
      <div className="px-6 py-8 pb-16 space-y-5">
        <div className="h-8 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const tips: Array<{ icon: React.ReactNode; text: string; href?: string }> = [];
  if (todayAppts.length === 0) {
    tips.push({
      icon: <PartyPopper className="w-4 h-4" />,
      text: t('freeDay'),
      href: '/calendar',
    });
  }
  for (const bd of upcomingBirthdays) {
    const label = bd.daysUntil === 0
      ? t('birthdayToday')
      : bd.daysUntil === 1 ? t('birthdayTomorrow') : t('birthdayInDays', { n: bd.daysUntil });
    tips.push({
      icon: <Cake className="w-4 h-4" />,
      text: `${bd.full_name} — ${label}`,
      href: '/clients',
    });
  }
  for (const rem of overdueReminders) {
    tips.push({
      icon: <Bell className="w-4 h-4" />,
      text: rem.text,
    });
  }

  return (
    <div className="px-6 py-8 pb-16 space-y-6 max-w-6xl">
      <motion.div {...stagger(0)}>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting(t)}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
        </p>
      </motion.div>

      <motion.div {...stagger(1)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('todayAppointments')}
          value={todayAppts.length}
          icon={<CalendarIcon className="w-5 h-5" />}
        />
        <StatCard
          label={`${t('revenue')} · ${t('today').toLowerCase()}`}
          value={fmtMoney(todayRevenue)}
          icon={<Coins className="w-5 h-5" />}
        />
        <StatCard
          label={t('thisWeek')}
          value={fmtMoney(weekRevenue)}
          icon={<Users className="w-5 h-5" />}
        />
      </motion.div>

      <motion.section {...stagger(2)} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('todaySchedule')}
          </h2>
          <Link href="/calendar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t('viewAll')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {todayAppts.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="w-6 h-6" />}
            title={t('noAppointmentsToday')}
            description={t('emptyScheduleDesc')}
            action={
              <Link href="/calendar" className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                {t('newAppointment')}
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {todayAppts.map((a) => (
              <AppointmentCard
                key={a.id}
                startsAt={a.starts_at}
                endsAt={a.ends_at}
                clientName={a.client?.full_name || '—'}
                serviceName={a.service?.name ?? null}
                price={a.price ?? null}
                currency={CURRENCY}
                status={(a.status as AppointmentStatus) || 'booked'}
              />
            ))}
          </div>
        )}
      </motion.section>

      {tips.length > 0 && (
        <motion.section {...stagger(3)} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            {t('remindersTitle')}
          </h2>
          <div className="space-y-2">
            {tips.map((tip, i) => {
              const Wrapper: React.ElementType = tip.href ? Link : 'div';
              const wrapperProps = tip.href ? { href: tip.href } : {};
              return (
                <Wrapper
                  key={i}
                  {...wrapperProps}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm hover:bg-muted/40 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                    {tip.icon}
                  </div>
                  <span className="flex-1">{tip.text}</span>
                  {tip.href && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                </Wrapper>
              );
            })}
          </div>
        </motion.section>
      )}

      <motion.div {...stagger(4)} className="flex items-center gap-2 rounded-xl border border-dashed bg-card/50 p-3 text-xs text-muted-foreground">
        <Mic className="w-4 h-4 text-[var(--ds-accent)]" />
        <span>{t('noReminders')}</span>
      </motion.div>
    </div>
  );
}
