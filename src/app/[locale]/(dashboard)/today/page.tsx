/** --- YAML
 * name: Today Page
 * description: Master dashboard под Open Design эталон.
 *              KPI strip (4 карточки) + расписание дня (timeline) +
 *              быстрые действия panel + ДР клиентов/партнёров +
 *              напоминания. AI-помощник переехал в хедер dashboard
 *              (HeaderAiAssistant) — здесь его нет.
 * created: 2026-04-19
 * updated: 2026-05-11
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
import {
  Calendar as CalendarIcon, Coins, Users, Cake, Bell, Check,
  CalendarPlus, Plus, Lock, TrendingUp, Receipt, Wallet,
  PlayCircle, CheckCircle2, Hourglass,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { CURRENCY, pageContainer } from '@/lib/dashboard-theme';
import { RebookPanel, type RebookCardData } from '@/components/rebook/rebook-panel';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

type Status = 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'cancelled_by_client';

interface Appointment {
  id: string; starts_at: string; ends_at: string; status: Status; price: number | null;
  client_id?: string | null;
  service?: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null;
  client?: { full_name: string } | { full_name: string }[] | null;
}

interface ClientBirthday { id: string; full_name: string; date_of_birth: string; kind: 'client' | 'partner'; }
interface Reminder { id: string; text: string; due_at: string | null; }

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

function birthdayMeta(dob: string, dfLoc: typeof ru) {
  const birth = new Date(dob);
  const next = nextBirthday(dob);
  return {
    dateLabel: format(next, 'd MMMM', { locale: dfLoc }),
    age: getYear(next) - getYear(birth),
  };
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
});

/** Premium KPI tile — accent-left optional, hover-lift, large tabular value. */
function KpiTile({
  label, value, icon, delta, accent, valueColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  delta?: { text: string; positive?: boolean };
  accent?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      className="group relative rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{
        borderLeftWidth: accent ? 3 : 1,
        borderLeftColor: accent ? 'var(--ds-accent)' : undefined,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
          {icon}
        </div>
      </div>
      <div
        className="mt-3 text-[28px] font-bold leading-none tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      {delta && (
        <div
          className="mt-2 text-[12px] font-medium"
          style={{ color: delta.positive === false ? 'var(--m-danger)' : 'var(--m-success)' }}
        >
          {delta.text}
        </div>
      )}
    </div>
  );
}

/** Расписание дня — Open Design timeline */
function ScheduleTimeline({
  appointments, locale,
}: { appointments: Appointment[]; locale: Locale }) {
  const now = Date.now();
  const todayAppts = appointments
    .filter((a) => a.status !== 'cancelled' && a.status !== 'cancelled_by_client')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (todayAppts.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon className="w-5 h-5" />}
        title="Сегодня записей нет"
        description="Свободный день. Добавь запись или жди онлайн-бронирования."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {todayAppts.map((a) => {
        const startMs = new Date(a.starts_at).getTime();
        const endMs = new Date(a.ends_at).getTime();
        const isCurrent = a.status === 'in_progress' || (startMs <= now && endMs >= now && a.status !== 'completed');
        const isDone = a.status === 'completed';
        const service = Array.isArray(a.service) ? a.service[0] : a.service;
        const client = Array.isArray(a.client) ? a.client[0] : a.client;
        const time = format(new Date(a.starts_at), 'HH:mm', { locale });
        const endTime = format(new Date(a.ends_at), 'HH:mm', { locale });
        const duration = Math.round((endMs - startMs) / 60000);
        return (
          <li key={a.id}>
            <Link
              href={`/calendar?id=${a.id}`}
              className="flex items-stretch gap-3 rounded-xl border bg-card p-3.5 transition-all duration-200 hover:shadow-md"
              style={{
                borderColor: isCurrent ? 'var(--ds-accent)' : undefined,
                borderLeftWidth: 3,
                borderLeftColor: isCurrent ? 'var(--ds-accent)' : isDone ? 'var(--m-success)' : 'var(--ds-border)',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                textDecoration: 'none',
              }}
            >
              <div className="flex flex-col items-center min-w-[52px] gap-0.5">
                <div
                  className="text-[15px] font-bold leading-none"
                  style={{
                    color: isCurrent ? 'var(--ds-accent)' : 'var(--ds-text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {time}
                </div>
                <div className="text-[11px] text-muted-foreground">{duration} мин</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: 'var(--ds-text)' }}>
                  {client?.full_name ?? 'Клиент'}
                </div>
                <div className="text-[12.5px] text-muted-foreground truncate mt-0.5">
                  {service?.name ?? '—'} · {time}—{endTime}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {a.price && Number(a.price) > 0 && (
                    <span className="text-[12px] font-bold" style={{ color: 'var(--ds-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {new Intl.NumberFormat('ru-RU').format(Number(a.price))} ₴
                    </span>
                  )}
                  {isCurrent ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: 'var(--ds-accent-soft)', color: 'var(--ds-accent)' }}
                    >
                      <PlayCircle className="w-3 h-3" /> Сейчас
                    </span>
                  ) : isDone ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: 'var(--m-success-soft)', color: 'var(--m-success)' }}
                    >
                      <CheckCircle2 className="w-3 h-3" /> Завершено
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    >
                      <Hourglass className="w-3 h-3" /> Запланировано
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function TodayPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;

  const { master, loading: masterLoading } = useMaster();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [birthdays, setBirthdays] = useState<ClientBirthday[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebookItems, setRebookItems] = useState<RebookCardData[]>([]);

  const fetchToday = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfDay(now);

    const [apptRes, clientRes, remRes, partnersRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, starts_at, ends_at, status, price, client_id, service:services(id, name, color), client:clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', weekStart.toISOString())
        .lte('starts_at', weekEnd.toISOString())
        .order('starts_at', { ascending: true }),
      supabase.from('clients')
        .select('id, full_name, date_of_birth')
        .eq('master_id', master.id)
        .not('date_of_birth', 'is', null),
      supabase.from('reminders')
        .select('id, text, due_at')
        .eq('master_id', master.id)
        .eq('completed', false)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(5),
      supabase.from('master_partnerships')
        .select('id, partner:masters!master_partnerships_partner_id_fkey(id, display_name, profile:profiles!masters_profile_id_fkey(full_name, date_of_birth))')
        .eq('master_id', master.id)
        .eq('status', 'accepted'),
    ]);

    setAppointments((apptRes.data as unknown as Appointment[]) || []);

    const clientRows = ((clientRes.data ?? []) as Array<{ id: string; full_name: string; date_of_birth: string }>)
      .map((c) => ({ ...c, kind: 'client' as const }));

    type PartnerRow = {
      id: string;
      partner: { id: string; display_name: string | null; profile: { full_name: string | null; date_of_birth: string | null } | { full_name: string | null; date_of_birth: string | null }[] | null } | null;
    };
    const partnerRows: ClientBirthday[] = ((partnersRes.data ?? []) as unknown as PartnerRow[])
      .flatMap((row) => {
        const p = row.partner;
        if (!p) return [];
        const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
        const dob = profile?.date_of_birth;
        if (!dob) return [];
        return [{
          id: `partner:${p.id}`,
          full_name: p.display_name || profile?.full_name || 'Партнёр',
          date_of_birth: dob,
          kind: 'partner' as const,
        }];
      });

    setBirthdays([...clientRows, ...partnerRows]);
    setReminders((remRes.data as unknown as Reminder[]) || []);

    fetch('/api/rebook/list')
      .then((r) => (r.ok ? r.json() : Promise.resolve({ items: [] })))
      .then((d) => setRebookItems((d.items as RebookCardData[]) ?? []))
      .catch(() => setRebookItems([]));

    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (masterLoading) return;
    if (!master?.id) { setLoading(false); return; }
    fetchToday();
  }, [master?.id, masterLoading, fetchToday]);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const todayAppts = useMemo(
    () => appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return d >= todayStart && d <= todayEnd && a.status !== 'cancelled' && a.status !== 'cancelled_by_client';
    }),
    [appointments, todayStart, todayEnd],
  );

  const todayCompleted = useMemo(
    () => todayAppts.filter((a) => a.status === 'completed'),
    [todayAppts],
  );

  const todayUpcoming = useMemo(
    () => todayAppts.filter((a) => {
      const d = new Date(a.starts_at).getTime();
      return d > Date.now() && a.status !== 'completed';
    }),
    [todayAppts],
  );

  const todayRevenue = useMemo(
    () => todayCompleted.reduce((s, a) => s + (Number(a.price) || 0), 0),
    [todayCompleted],
  );

  const avgCheck = useMemo(() => {
    const completed = appointments.filter((a) => a.status === 'completed');
    if (completed.length === 0) return 0;
    const sum = completed.reduce((s, a) => s + (Number(a.price) || 0), 0);
    return Math.round(sum / completed.length);
  }, [appointments]);

  const upcomingBirthdays = useMemo(() => {
    const all = birthdays
      .map((c) => {
        const next = nextBirthday(c.date_of_birth);
        const daysUntil = differenceInDays(startOfDay(next), todayStart);
        return { ...c, daysUntil };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
    const inWindow = all.filter((c) => c.daysUntil >= 0 && c.daysUntil <= 90).slice(0, 5);
    if (inWindow.length > 0) return inWindow;
    const nextOne = all.find((c) => c.daysUntil >= 0);
    return nextOne ? [nextOne] : [];
  }, [birthdays, todayStart]);

  const activeReminders = useMemo(() => reminders.slice(0, 5), [reminders]);

  // newClientsThisWeek больше не нужен — мы перешли на «Средний чек» KPI

  const firstName = master?.profile?.first_name || master?.profile?.full_name?.split(' ')[0] || '';
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ' + CURRENCY;

  // AI tip — выбирает случайную полезную подсказку на основе данных
  const aiTip = useMemo(() => {
    // Спящие клиенты
    const sleepingClient = birthdays.find((b) => b.kind === 'client');
    if (todayUpcoming.length > 0) {
      const next = todayUpcoming[0];
      const time = format(new Date(next.starts_at), 'HH:mm', { locale: dfLocale });
      const client = Array.isArray(next.client) ? next.client[0] : next.client;
      return {
        label: 'Подсказка',
        text: `Следующая запись в ${time} — ${client?.full_name ?? 'клиент'}. Готово ли всё?`,
      };
    }
    if (sleepingClient && upcomingBirthdays.find((b) => b.id === sleepingClient.id && b.daysUntil <= 14)) {
      return {
        label: 'Подсказка',
        text: `У ${sleepingClient.full_name} скоро день рождения — поздравь и предложи запись.`,
      };
    }
    if (todayAppts.length === 0) {
      return {
        label: 'Подсказка',
        text: 'Сегодня свободный день. Хороший момент написать спящим клиентам — предложи запись.',
      };
    }
    return null;
  }, [todayUpcoming, todayAppts, upcomingBirthdays, birthdays, dfLocale]);

  if (masterLoading || loading) {
    return (
      <div style={pageContainer} className="space-y-5">
        <div className="h-8 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div style={pageContainer} className="flex flex-col gap-5 pb-12">
      {/* Greeting */}
      <motion.div {...stagger(0)} className="shrink-0">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-none">
          {getGreeting(t)}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground capitalize">
          {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
        </p>
      </motion.div>

      {/* Premium KPI strip — Open Design: 4 cards (Доход дня + Завершено + Впереди + Средний чек) */}
      <motion.div {...stagger(1)} className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiTile
          label="Доход дня"
          value={fmtMoney(todayRevenue)}
          icon={<TrendingUp className="w-4 h-4" />}
          accent
          valueColor="var(--m-success)"
          delta={todayCompleted.length > 0 ? { text: `${todayCompleted.length} ${todayCompleted.length === 1 ? 'визит' : 'визитов'}`, positive: true } : undefined}
        />
        <KpiTile
          label="Завершено"
          value={todayCompleted.length}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <KpiTile
          label="Впереди"
          value={todayUpcoming.length}
          icon={<CalendarIcon className="w-4 h-4" />}
        />
        <KpiTile
          label="Средний чек"
          value={avgCheck > 0 ? fmtMoney(avgCheck) : '—'}
          icon={<Receipt className="w-4 h-4" />}
        />
      </motion.div>

      {/* AI Tip — показывается когда есть полезная подсказка */}
      {aiTip && (
        <motion.div
          {...stagger(2)}
          className="shrink-0 rounded-2xl p-4"
          style={{
            background: 'var(--ds-accent-soft)',
            border: '1px solid color-mix(in oklab, var(--ds-accent) 25%, transparent)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--ds-accent)', color: '#fff' }}
            >
              <Wallet className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--ds-accent)' }}>
                {aiTip.label}
              </div>
              <div className="text-[14px] leading-relaxed text-foreground">
                {aiTip.text}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rebook suggestions */}
      {rebookItems.length > 0 && (
        <motion.div {...stagger(3)} className="shrink-0">
          <RebookPanel items={rebookItems} />
        </motion.div>
      )}

      {/* Main grid: Schedule (2 col) + Right column (Quick Actions + ДР + Reminders, 1 col) */}
      <motion.div {...stagger(4)} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Schedule timeline */}
        <section className="lg:col-span-2 flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="flex items-center gap-2 text-[14px] font-bold tracking-[-0.01em]">
              <CalendarIcon className="w-4 h-4 text-[var(--ds-accent)]" />
              Расписание дня
            </h2>
            <Link
              href="/calendar"
              className="text-[12px] font-semibold text-[var(--ds-accent)] hover:underline"
            >
              Открыть календарь →
            </Link>
          </div>
          <div className="flex-1 p-4">
            <ScheduleTimeline appointments={todayAppts} locale={dfLocale} />
          </div>
        </section>

        {/* Right column: Quick Actions + ДР + Reminders */}
        <div className="flex flex-col gap-5">
          {/* Quick Actions */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                Быстрые действия
              </h2>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <QuickAction href="/calendar?new=1" icon={<CalendarPlus className="w-4 h-4" />} label="Новая запись" accent />
              <QuickAction href="/finance?add=income" icon={<TrendingUp className="w-4 h-4" />} label="Доход" />
              <QuickAction href="/finance?add=expense" icon={<Receipt className="w-4 h-4" />} label="Расход" />
              <QuickAction href="/clients?add=1" icon={<Plus className="w-4 h-4" />} label="Клиент" />
            </div>
          </div>

          {/* Birthdays */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-[-0.01em]">
                <Cake className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
                Ближайшие ДР
              </h2>
            </div>
            <div className="p-4">
              {upcomingBirthdays.length === 0 ? (
                <EmptyState
                  icon={<Cake className="w-5 h-5" />}
                  title="Нет дат рождения"
                  description="Добавь ДР в карточке клиента."
                />
              ) : (
                <ul className="space-y-2">
                  {upcomingBirthdays.map((c) => {
                    const meta = birthdayMeta(c.date_of_birth, dfLocale);
                    const whenLabel =
                      c.daysUntil === 0 ? 'сегодня' :
                      c.daysUntil === 1 ? 'завтра' :
                      `через ${c.daysUntil} дн.`;
                    const isPartner = c.kind === 'partner';
                    return (
                      <li key={c.id} className="flex items-center gap-2.5 rounded-lg bg-muted/30 p-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                          <Cake className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[13px] font-semibold">{c.full_name}</p>
                            {isPartner && (
                              <span className="shrink-0 rounded-full bg-[var(--ds-accent-soft)] px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-[var(--ds-accent)]">
                                партнёр
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {meta.dateLabel} · {meta.age} {meta.age % 10 === 1 && meta.age % 100 !== 11 ? 'год' : meta.age % 10 >= 2 && meta.age % 10 <= 4 && (meta.age % 100 < 10 || meta.age % 100 >= 20) ? 'года' : 'лет'} · {whenLabel}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Reminders */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-[-0.01em]">
                <Bell className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
                Напоминания
              </h2>
            </div>
            <div className="p-4">
              {activeReminders.length === 0 ? (
                <EmptyState
                  icon={<Bell className="w-5 h-5" />}
                  title="Нет напоминаний"
                  description="Добавь голосом в Telegram-боте."
                />
              ) : (
                <ul className="space-y-2">
                  {activeReminders.map((r) => (
                    <li key={r.id} className="group flex items-start gap-2 rounded-lg bg-muted/30 p-2.5 text-sm">
                      <button
                        type="button"
                        onClick={async () => {
                          const supabase = createClient();
                          await supabase.from('reminders').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', r.id);
                          setReminders((prev) => prev.filter((x) => x.id !== r.id));
                        }}
                        aria-label="Отметить выполненным"
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ds-accent)]/40 bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] transition-all hover:bg-[var(--ds-accent)] hover:text-white"
                      >
                        <Bell className="w-3 h-3 group-hover:hidden" />
                        <Check className="hidden w-3 h-3 group-hover:block" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[13px]">{r.text}</p>
                        {r.due_at && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {format(new Date(r.due_at), 'd MMM, HH:mm', { locale: dfLocale })}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** Quick Action кнопка с акцентом */
function QuickAction({
  href, icon, label, accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 rounded-xl border p-3 transition-all duration-200 hover:shadow-md"
      style={{
        background: accent ? 'var(--ds-accent)' : 'transparent',
        borderColor: accent ? 'var(--ds-accent)' : 'var(--ds-border)',
        color: accent ? '#fff' : 'var(--ds-text)',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        textDecoration: 'none',
      }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{
          background: accent ? 'rgba(255,255,255,0.22)' : 'var(--ds-accent-soft)',
          color: accent ? '#fff' : 'var(--ds-accent)',
        }}
      >
        {icon}
      </div>
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
    </Link>
  );
}
