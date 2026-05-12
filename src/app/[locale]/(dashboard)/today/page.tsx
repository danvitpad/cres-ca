/** --- YAML
 * name: Today Page
 * description: Точный порт Open Design master-dashboard.html (desktop frame).
 *              KPI strip (4 cards, success-left на доходе, NO icons) + content-grid
 *              1.5fr/1fr (Расписание дня timeline с dots на вертикальной линии +
 *              gap-indicators + right column AI Tip + Quick Actions 4 цветов).
 *              Ниже — карточки ДР и Напоминаний (фича специфичная для проекта).
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
  Calendar as CalendarIcon, Cake, Bell, Check,
  CalendarPlus, UserPlus, PlusCircle, MinusCircle,
  TrendingUp, Clock, Lightbulb,
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

function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '—';
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
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
    if (todayCompleted.length === 0) return 0;
    return Math.round(todayRevenue / todayCompleted.length);
  }, [todayCompleted, todayRevenue]);

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

  const firstName = master?.profile?.first_name || master?.profile?.full_name?.split(' ')[0] || '';
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ' + CURRENCY;

  // Sorted timeline rows + gap markers (Open Design pattern)
  type TimelineItem =
    | { kind: 'appt'; appt: Appointment; isCurrent: boolean; isDone: boolean }
    | { kind: 'gap'; from: string; to: string };
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const sorted = [...todayAppts].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const items: TimelineItem[] = [];
    const nowMs = Date.now();
    const GAP_MIN = 30; // показываем gap только если ≥30 минут свободно
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const startMs = new Date(a.starts_at).getTime();
      const endMs = new Date(a.ends_at).getTime();
      const isCurrent = a.status === 'in_progress' || (startMs <= nowMs && endMs >= nowMs && a.status !== 'completed');
      const isDone = a.status === 'completed';
      items.push({ kind: 'appt', appt: a, isCurrent, isDone });
      const next = sorted[i + 1];
      if (next) {
        const nextStartMs = new Date(next.starts_at).getTime();
        const gapMin = Math.round((nextStartMs - endMs) / 60000);
        if (gapMin >= GAP_MIN) {
          items.push({
            kind: 'gap',
            from: format(new Date(endMs), 'HH:mm', { locale: dfLocale }),
            to: format(new Date(nextStartMs), 'HH:mm', { locale: dfLocale }),
          });
        }
      }
    }
    return items;
  }, [todayAppts, dfLocale]);

  // AI tip — динамическая
  const aiTip = useMemo(() => {
    if (todayUpcoming.length > 0) {
      const next = todayUpcoming[0];
      const time = format(new Date(next.starts_at), 'HH:mm', { locale: dfLocale });
      const client = Array.isArray(next.client) ? next.client[0] : next.client;
      return `Следующая запись в ${time} — ${client?.full_name ?? 'клиент'}. Готово ли всё?`;
    }
    const birthdayToday = upcomingBirthdays.find((b) => b.daysUntil === 0);
    if (birthdayToday) return `У ${birthdayToday.full_name} сегодня день рождения! Поздравь и предложи запись.`;
    const birthdaySoon = upcomingBirthdays.find((b) => b.daysUntil > 0 && b.daysUntil <= 7);
    if (birthdaySoon) return `У ${birthdaySoon.full_name} ДР через ${birthdaySoon.daysUntil} дн. — поздравь и предложи запись.`;
    if (todayAppts.length === 0) {
      return 'Сегодня свободный день. Хороший момент написать спящим клиентам — предложи запись.';
    }
    return null;
  }, [todayUpcoming, todayAppts.length, upcomingBirthdays, dfLocale]);

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
    <div style={pageContainer} className="flex flex-col gap-6 pb-12">
      {/* Page title — точно по эталону Open Design */}
      <motion.div {...stagger(0)} className="shrink-0">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-none">
          {getGreeting(t)}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 text-sm capitalize" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
          {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
        </p>
      </motion.div>

      {/* KPI Strip — 4 cards, success-border-left на первом (Доход), БЕЗ иконок */}
      <motion.div {...stagger(1)} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Доход дня"
          value={fmtMoney(todayRevenue)}
          delta={todayCompleted.length > 0 ? { text: `${todayCompleted.length} ${todayCompleted.length === 1 ? 'визит' : 'визитов'}`, positive: true } : undefined}
          variant="success"
        />
        <KpiCard
          label="Завершено"
          value={String(todayCompleted.length)}
          sub={todayAppts.length > 0 ? `из ${todayAppts.length} ${todayAppts.length === 1 ? 'записи' : 'записей'}` : '—'}
        />
        <KpiCard
          label="Впереди"
          value={String(todayUpcoming.length)}
          sub={todayUpcoming.length > 0 ? `${todayUpcoming.length === 1 ? 'запись' : todayUpcoming.length < 5 ? 'записи' : 'записей'}` : 'нет'}
        />
        <KpiCard
          label="Средний чек"
          value={avgCheck > 0 ? fmtMoney(avgCheck) : '—'}
          sub={todayCompleted.length > 0 ? 'по записям' : undefined}
        />
      </motion.div>

      {/* Rebook suggestions (выше grid'а) */}
      {rebookItems.length > 0 && (
        <motion.div {...stagger(2)}>
          <RebookPanel items={rebookItems} />
        </motion.div>
      )}

      {/* Content Grid: 1.5fr | 1fr (Open Design) */}
      <motion.div {...stagger(3)} className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
        {/* LEFT: Расписание дня (timeline с dots) */}
        <Card>
          <CardHeader title="Расписание дня" right={
            <span className="text-xs" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
              {todayAppts.length === 0 ? 'свободно' : `${todayAppts.length} ${todayAppts.length === 1 ? 'запись' : todayAppts.length < 5 ? 'записи' : 'записей'}`}
            </span>
          } />
          <div className="px-6 py-5">
            {timelineItems.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="w-5 h-5" />}
                title="Сегодня записей нет"
                description="Свободный день. Добавьте запись или ждите онлайн-бронирования."
              />
            ) : (
              <DesktopTimeline items={timelineItems} dfLocale={dfLocale} />
            )}
          </div>
        </Card>

        {/* RIGHT column: AI Tip + Quick Actions */}
        <div className="flex flex-col gap-4">
          {aiTip && <AiTipCard text={aiTip} />}
          <Card>
            <CardHeader title="Быстрые действия" />
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-2.5">
                <QaButton href="/calendar?new=1" icon={<CalendarPlus className="w-4 h-4" />} label="Новая запись" variant="primary" />
                <QaButton href="/clients?add=1" icon={<UserPlus className="w-4 h-4" />} label="Добавить клиента" variant="secondary" />
                <QaButton href="/finance?add=income" icon={<PlusCircle className="w-4 h-4" />} label="Доход" variant="success" />
                <QaButton href="/finance?add=expense" icon={<MinusCircle className="w-4 h-4" />} label="Расход" variant="danger" />
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Birthdays + Reminders — ниже основной 2-col grid'а */}
      <motion.div {...stagger(4)} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Ближайшие дни рождения" left={<Cake className="w-4 h-4" style={{ color: 'var(--ds-accent)' }} />} />
          <div className="px-6 py-5">
            {upcomingBirthdays.length === 0 ? (
              <EmptyState
                icon={<Cake className="w-5 h-5" />}
                title="Нет дат рождения"
                description="Добавьте дату рождения клиенту в его карточке."
              />
            ) : (
              <ul className="space-y-2.5">
                {upcomingBirthdays.map((c) => {
                  const meta = birthdayMeta(c.date_of_birth, dfLocale);
                  const whenLabel =
                    c.daysUntil === 0 ? 'сегодня' :
                    c.daysUntil === 1 ? 'завтра' :
                    `через ${c.daysUntil} дн.`;
                  const isPartner = c.kind === 'partner';
                  const ageWord = meta.age % 10 === 1 && meta.age % 100 !== 11 ? 'год' :
                    meta.age % 10 >= 2 && meta.age % 10 <= 4 && (meta.age % 100 < 10 || meta.age % 100 >= 20) ? 'года' : 'лет';
                  return (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl p-3"
                      style={{
                        background: 'var(--ds-surface-elevated, rgba(0,0,0,0.02))',
                        border: '1px solid var(--ds-border, rgba(0,0,0,0.06))',
                      }}>
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: 'var(--ds-accent-soft)', color: 'var(--ds-accent)' }}
                      >
                        {getInitials(c.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13.5px] font-semibold">{c.full_name}</p>
                          {isPartner && (
                            <span className="shrink-0 rounded-full px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide"
                              style={{ background: 'var(--ds-accent-soft)', color: 'var(--ds-accent)' }}>
                              партнёр
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
                          {meta.dateLabel} · {meta.age} {ageWord} · {whenLabel}
                        </p>
                      </div>
                      <Cake className="w-4 h-4 shrink-0" style={{ color: 'var(--ds-accent)' }} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Напоминания" left={<Bell className="w-4 h-4" style={{ color: 'var(--ds-accent)' }} />} />
          <div className="px-6 py-5">
            {activeReminders.length === 0 ? (
              <EmptyState
                icon={<Bell className="w-5 h-5" />}
                title="Нет напоминаний"
                description="Добавьте голосом в Telegram-боте."
              />
            ) : (
              <ul className="space-y-2.5">
                {activeReminders.map((r) => (
                  <li key={r.id} className="group flex items-start gap-2.5 rounded-xl p-3 text-sm"
                    style={{
                      background: 'var(--ds-surface-elevated, rgba(0,0,0,0.02))',
                      border: '1px solid var(--ds-border, rgba(0,0,0,0.06))',
                    }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.from('reminders').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', r.id);
                        setReminders((prev) => prev.filter((x) => x.id !== r.id));
                      }}
                      aria-label="Отметить выполненным"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all"
                      style={{
                        border: '1.5px solid var(--ds-accent)',
                        color: 'var(--ds-accent)',
                        background: 'transparent',
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] leading-snug">{r.text}</p>
                      {r.due_at && (
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
                          {format(new Date(r.due_at), 'd MMM, HH:mm', { locale: dfLocale })}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

/* ─── KPI Card (Open Design): label + value + delta/sub, NO icon ─── */
function KpiCard({
  label, value, delta, sub, variant,
}: {
  label: string;
  value: string;
  delta?: { text: string; positive?: boolean };
  sub?: string;
  variant?: 'success';
}) {
  return (
    <div
      className="rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-default"
      style={{
        borderLeftWidth: variant === 'success' ? 3 : 1,
        borderLeftColor: variant === 'success' ? '#10b981' : undefined,
        fontVariantNumeric: 'tabular-nums',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
        {label}
      </div>
      <div className="mt-2 text-[32px] font-bold leading-none tracking-[-0.03em]">
        {value}
      </div>
      {delta && (
        <div
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium"
          style={{ color: delta.positive === false ? '#ef4444' : '#10b981' }}
        >
          <TrendingUp className="w-3 h-3" />
          {delta.text}
        </div>
      )}
      {!delta && sub && (
        <div className="mt-2 text-[12px]" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─── Card primitives (Open Design `.card` + `.card-header` + `.card-body`) ─── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-md"
      style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
      {children}
    </div>
  );
}

function CardHeader({ title, right, left }: { title: string; right?: React.ReactNode; left?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-[14px] border-b" style={{ borderColor: 'var(--ds-border, rgba(0,0,0,0.06))' }}>
      <div className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em]">
        {left}
        {title}
      </div>
      {right}
    </div>
  );
}

/* ─── AI Tip Card (Open Design `.desktop-ai-tip` pattern) ─── */
function AiTipCard({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--ds-accent-soft)',
        borderColor: 'color-mix(in oklab, var(--ds-accent) 25%, transparent)',
      }}
    >
      <div
        className="px-6 py-[14px] border-b"
        style={{
          borderColor: 'color-mix(in oklab, var(--ds-accent) 25%, transparent)',
        }}
      >
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: 'var(--ds-accent)' }}>
          <Lightbulb className="w-3 h-3" />
          Подсказка ИИ
        </div>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--ds-accent)', color: '#fff' }}
          >
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] leading-[1.55]" style={{ color: 'var(--ds-text-secondary, #525252)' }}>
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Action button (Open Design `.qa-btn-*` variants) ─── */
function QaButton({
  href, icon, label, variant,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  variant: 'primary' | 'secondary' | 'success' | 'danger';
}) {
  const styles = (() => {
    switch (variant) {
      case 'primary':
        return { background: 'var(--ds-accent)', color: '#fff', borderColor: 'var(--ds-accent)' };
      case 'success':
        return { background: 'rgba(16, 185, 129, 0.10)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.30)' };
      case 'danger':
        return { background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)' };
      default:
        return { background: 'transparent', color: 'var(--ds-text, #0a0a0a)', borderColor: 'var(--ds-border, rgba(0,0,0,0.10))' };
    }
  })();
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[13px] font-semibold transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
      style={{
        ...styles,
        border: `1px solid ${styles.borderColor}`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        textDecoration: 'none',
      }}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

/* ─── Desktop Timeline (Open Design `.desktop-timeline` exact port) ─── */
function DesktopTimeline({
  items, dfLocale,
}: {
  items: Array<
    | { kind: 'appt'; appt: Appointment; isCurrent: boolean; isDone: boolean }
    | { kind: 'gap'; from: string; to: string }
  >;
  dfLocale: typeof ru;
}) {
  return (
    <div className="relative">
      {/* Вертикальная линия — left:44px от начала контейнера, до низа */}
      <div
        className="absolute w-px"
        style={{
          left: 60,
          top: 16,
          bottom: 16,
          background: 'var(--ds-border, rgba(0,0,0,0.08))',
          zIndex: 0,
        }}
      />
      <div className="flex flex-col">
        {items.map((it, idx) => {
          if (it.kind === 'gap') {
            return (
              <div
                key={`gap-${idx}`}
                className="flex items-center gap-2 py-2 pl-[80px] text-[11px]"
                style={{ color: 'var(--ds-text-tertiary, #71717a)' }}
              >
                <div className="flex-1 h-px" style={{ background: 'var(--ds-border, rgba(0,0,0,0.06))' }} />
                <span>{it.from} — {it.to} · свободно</span>
                <div className="flex-1 h-px" style={{ background: 'var(--ds-border, rgba(0,0,0,0.06))' }} />
              </div>
            );
          }
          const a = it.appt;
          const startTime = format(new Date(a.starts_at), 'HH:mm', { locale: dfLocale });
          const endTime = format(new Date(a.ends_at), 'HH:mm', { locale: dfLocale });
          const duration = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000);
          const service = Array.isArray(a.service) ? a.service[0] : a.service;
          const client = Array.isArray(a.client) ? a.client[0] : a.client;
          return (
            <Link
              key={a.id}
              href={`/calendar?id=${a.id}`}
              className="relative flex items-start gap-0 py-2.5 cursor-pointer"
              style={{ textDecoration: 'none' }}
            >
              {/* Time column */}
              <div className="w-[52px] flex-shrink-0 text-right pr-3 pt-3.5">
                <span
                  className="text-[12px] font-semibold"
                  style={{
                    color: it.isCurrent ? 'var(--ds-accent)' : 'var(--ds-text-tertiary, #71717a)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {startTime}
                </span>
              </div>
              {/* Dot on vertical line */}
              <div
                className="rounded-full mt-[18px] relative"
                style={{
                  width: it.isCurrent ? 12 : 10,
                  height: it.isCurrent ? 12 : 10,
                  background: it.isCurrent ? 'var(--ds-accent)' : 'var(--ds-border-strong, rgba(0,0,0,0.20))',
                  border: '2px solid var(--ds-card, #fff)',
                  zIndex: 1,
                  boxShadow: it.isCurrent ? '0 0 0 3px var(--ds-accent-soft)' : undefined,
                  flexShrink: 0,
                  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
              {/* Card */}
              <div
                className="flex-1 ml-3 rounded-xl border p-3.5 transition-all duration-200"
                style={{
                  background: it.isCurrent ? 'var(--ds-accent-soft)' : 'var(--ds-card, #fff)',
                  borderColor: it.isCurrent ? 'color-mix(in oklab, var(--ds-accent) 30%, transparent)' : 'var(--ds-border, rgba(0,0,0,0.06))',
                  borderLeftWidth: it.isCurrent ? 3 : 1,
                  borderLeftColor: it.isCurrent ? 'var(--ds-accent)' : undefined,
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: it.isCurrent ? 'var(--ds-accent)' : 'var(--ds-surface-elevated, rgba(0,0,0,0.04))',
                      color: it.isCurrent ? '#fff' : 'var(--ds-text-secondary, #525252)',
                      border: it.isCurrent ? 'none' : '1px solid var(--ds-border, rgba(0,0,0,0.06))',
                    }}
                  >
                    {getInitials(client?.full_name ?? '—')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: 'var(--ds-text, #0a0a0a)' }}>
                      {client?.full_name ?? 'Клиент'}
                    </div>
                    <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
                      {service?.name ?? '—'}
                    </div>
                  </div>
                  <div className="ml-auto shrink-0">
                    <StatusBadge isCurrent={it.isCurrent} isDone={it.isDone} />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--ds-text-tertiary, #71717a)' }}>
                    <Clock className="w-3 h-3" />
                    {duration} мин · {startTime}—{endTime}
                  </span>
                  {a.price && Number(a.price) > 0 && (
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--ds-text, #0a0a0a)', fontVariantNumeric: 'tabular-nums' }}>
                      {new Intl.NumberFormat('ru-RU').format(Number(a.price))} ₴
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Status badge (Open Design `.badge-*`) ─── */
function StatusBadge({ isCurrent, isDone }: { isCurrent: boolean; isDone: boolean }) {
  if (isCurrent) {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]"
        style={{ background: 'var(--ds-accent)', color: '#fff' }}
      >
        Сейчас
      </span>
    );
  }
  if (isDone) {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]"
        style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}
      >
        Завершено
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]"
      style={{ background: 'var(--ds-surface-elevated, rgba(0,0,0,0.06))', color: 'var(--ds-text-tertiary, #71717a)' }}
    >
      Ожидает
    </span>
  );
}
