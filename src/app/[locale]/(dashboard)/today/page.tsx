/** --- YAML
 * name: Today Page
 * description: Центрированная сводка: приветствие + дата + 3 StatCards, ниже grid (Напоминания | Ближайшие ДР), ниже AI-чат со scoped-ответами по БД мастера. Расписание убрано — оно в /calendar.
 * created: 2026-04-19
 * updated: 2026-04-20
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { format, startOfDay, endOfDay, startOfWeek, differenceInDays, getYear, setYear, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import { Calendar as CalendarIcon, Coins, Users, Cake, Bell, Send, Loader2, Sparkles } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { StatCard } from '@/components/shared/primitives/stat-card';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { CURRENCY } from '@/lib/dashboard-theme';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface Appointment {
  id: string; starts_at: string; ends_at: string; status: string; price: number | null;
}

interface ClientBirthday { id: string; full_name: string; date_of_birth: string; }

interface Reminder { id: string; text: string; due_at: string | null; }

interface ChatMsg { role: 'user' | 'assistant'; content: string; ts: number; }

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

  // AI chat state
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const fetchToday = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfDay(now);

    const [apptRes, clientRes, remRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, starts_at, ends_at, status, price')
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
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, sending]);

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
      .filter((c) => c.daysUntil >= 0 && c.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  }, [birthdays, todayStart]);

  const activeReminders = useMemo(() => reminders.slice(0, 5), [reminders]);

  const firstName = master?.profile?.first_name || master?.profile?.full_name?.split(' ')[0] || '';
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) + ' ' + CURRENCY;

  async function sendChat() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    const userMsg: ChatMsg = { role: 'user', content: trimmed, ts: Date.now() };
    setChat((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const history = chat.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const json = await res.json().catch(() => ({}));
      const answer = res.ok && json.answer
        ? json.answer
        : (json.error === 'ai_unavailable' ? 'AI временно недоступен. Попробуй позже.' : 'Что-то пошло не так.');
      setChat((prev) => [...prev, { role: 'assistant', content: answer, ts: Date.now() }]);
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Ошибка сети.', ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  }

  if (masterLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 pb-16 space-y-5">
        <div className="h-8 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 pb-16 space-y-8">
      {/* Greeting */}
      <motion.div {...stagger(0)}>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting(t)}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
        </p>
      </motion.div>

      {/* 3 StatCards */}
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

      {/* Two-column: Reminders | Upcoming Birthdays */}
      <motion.div {...stagger(2)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reminders */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Bell className="w-4 h-4" />
              Напоминания
            </h2>
            <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Все
            </Link>
          </div>
          {activeReminders.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-5 h-5" />}
              title="Нет напоминаний"
              description="Добавь напоминания голосом в Telegram или вручную."
            />
          ) : (
            <ul className="space-y-2">
              {activeReminders.map((r) => (
                <li key={r.id} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3 text-sm">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{r.text}</p>
                    {r.due_at && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(r.due_at), 'd MMM, HH:mm', { locale: dfLocale })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming birthdays */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Cake className="w-4 h-4" />
              Ближайшие дни рождения
            </h2>
            <Link href="/clients" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Клиенты
            </Link>
          </div>
          {upcomingBirthdays.length === 0 ? (
            <EmptyState
              icon={<Cake className="w-5 h-5" />}
              title="Нет ближайших ДР"
              description="В ближайшие 30 дней — никого. Добавь даты в карточках клиентов."
            />
          ) : (
            <ul className="space-y-2">
              {upcomingBirthdays.map((c) => {
                const label =
                  c.daysUntil === 0 ? 'сегодня' :
                  c.daysUntil === 1 ? 'завтра' :
                  `через ${c.daysUntil} дн.`;
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 text-sm">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                      <Cake className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{c.full_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>

      {/* AI chat */}
      <motion.section {...stagger(3)} className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AI-помощник
          </h2>
          <span className="text-xs text-muted-foreground">отвечает по твоей БД</span>
        </div>

        {chat.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {chat.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--ds-accent)] text-white px-3.5 py-2 text-sm'
                    : 'mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/50 px-3.5 py-2 text-sm'
                }
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted/50 px-3.5 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                думаю...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
            }}
            rows={1}
            placeholder="Спроси что-нибудь — «сколько заработаю на этой неделе?», «кто спящий клиент?»"
            className="flex-1 resize-none rounded-lg border bg-background px-3.5 py-2.5 text-sm leading-snug outline-none focus:border-[var(--ds-accent)] min-h-[40px] max-h-[120px]"
            disabled={sending}
          />
          <button
            onClick={sendChat}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-accent)] text-white disabled:opacity-40 transition-opacity"
            aria-label="Отправить"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {chat.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ответы основаны только на ваших данных: записи, клиенты, услуги, расходы. Без доступа к чужим аккаунтам.
          </p>
        )}
      </motion.section>
    </div>
  );
}
