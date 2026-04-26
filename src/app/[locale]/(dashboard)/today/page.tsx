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
import { Calendar as CalendarIcon, Coins, Users, Cake, Bell, Send, Loader2, Sparkles, Trash2, HelpCircle, Check, CheckCircle2, XCircle, UserX, RotateCcw } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { StatCard } from '@/components/shared/primitives/stat-card';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { CURRENCY, pageContainer } from '@/lib/dashboard-theme';
import { RebookPanel, type RebookCardData } from '@/components/rebook/rebook-panel';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface Appointment {
  id: string; starts_at: string; ends_at: string; status: string; price: number | null;
  client_id?: string | null;
  service?: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null;
}

interface ClientBirthday { id: string; full_name: string; date_of_birth: string; kind: 'client' | 'partner'; }

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

/** Возвращает {date, age} к следующему ДР: «29 апреля» + сколько исполнится. */
function birthdayMeta(dob: string, dfLoc: typeof ru) {
  const birth = new Date(dob);
  const next = nextBirthday(dob);
  return {
    dateLabel: format(next, 'd MMMM', { locale: dfLoc }),
    age: getYear(next) - getYear(birth),
  };
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
  const [rebookItems, setRebookItems] = useState<RebookCardData[]>([]);

  // AI chat state
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Booking lifecycle / weekly load / top services moved to /stats.

  const fetchToday = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfDay(now);

    const [apptRes, clientRes, remRes, partnersRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, starts_at, ends_at, status, price, client_id, service:services(id, name, color)')
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
      // Партнёры — accepted master↔master, тянем ФИО + ДР через masters.profile
      supabase.from('master_partnerships')
        .select('id, partner:masters!master_partnerships_partner_id_fkey(id, display_name, profile:profiles!masters_profile_id_fkey(full_name, date_of_birth))')
        .eq('master_id', master.id)
        .eq('status', 'accepted'),
    ]);

    setAppointments((apptRes.data as unknown as Appointment[]) || []);

    // Merge clients + partners into birthdays list with `kind` discriminator
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

    // Load rebook suggestions (best-effort, never blocks render)
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

  // Weekly load + top services live on /stats now.

  const newClientsThisWeek = useMemo(() => {
    const ids = new Set<string>();
    for (const a of appointments) {
      const d = new Date(a.starts_at);
      if (d >= weekStart && d <= todayEnd && a.client_id) ids.add(a.client_id);
    }
    return ids.size;
  }, [appointments, weekStart, todayEnd]);

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
      // If an action was executed, refresh today widgets (reminders/birthdays/stats).
      if (json.executed) {
        fetchToday();
      }
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Ошибка сети.', ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  }

  if (masterLoading || loading) {
    return (
      <div style={pageContainer} className="space-y-5">
        <div className="h-8 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div
      style={{ ...pageContainer, height: 'calc(100dvh - 64px)' }}
      className="flex flex-col gap-4 overflow-hidden"
    >
      {/* Greeting */}
      <motion.div {...stagger(0)} className="shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">
          {getGreeting(t)}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground capitalize">
          {format(now, 'EEEE, d MMMM yyyy', { locale: dfLocale })}
        </p>
      </motion.div>

      {/* 4 StatCards */}
      <motion.div {...stagger(1)} className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          icon={<Coins className="w-5 h-5" />}
        />
        <StatCard
          label="Новые клиенты · неделя"
          value={newClientsThisWeek}
          icon={<Users className="w-5 h-5" />}
        />
      </motion.div>

      {/* Weekly load / top services / booking lifecycle moved to /stats —
          /today was over-stuffed and the user wanted these on a dedicated page.
          Sidebar now has a «Статистика» entry pointing there. */}

      {/* Rebook suggestions — show only when there are any */}
      {rebookItems.length > 0 && (
        <motion.div {...stagger(4)} className="shrink-0">
          <RebookPanel items={rebookItems} />
        </motion.div>
      )}

      {/* Row: Reminders | AI chat (wide) | Birthdays — fills remaining viewport */}
      <motion.div {...stagger(4)} className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0">
        {/* Reminders — 1 col, scrolls internally */}
        <div className="flex flex-col rounded-xl border bg-card p-4 lg:col-span-1 overflow-hidden min-h-0">
          <div className="flex items-center mb-3 shrink-0">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bell className="w-3.5 h-3.5" />
              Напоминания
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeReminders.length === 0 ? (
              <EmptyState
                icon={<Bell className="w-5 h-5" />}
                title="Нет напоминаний"
                description="Добавь голосом в Telegram-боте."
              />
            ) : (
              <ul className="space-y-2">
                {activeReminders.map((r) => (
                  <li key={r.id} className="group flex items-start gap-2 rounded-lg bg-muted/30 p-2 text-sm transition-colors hover:bg-muted/50">
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
                      <p className="truncate text-xs">{r.text}</p>
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

        {/* AI chat — 2 cols (widest), fills full block height */}
        <section className="flex flex-col rounded-xl border bg-card p-4 lg:col-span-2 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                AI-помощник
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHelp(v => !v)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                aria-label="Команды"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Команды
              </button>
              {chat.length > 0 && (
                <button
                  onClick={() => setChat([])}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  aria-label="Очистить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Очистить
                </button>
              )}
            </div>
          </div>

          {/* Chat body OR help panel — fills remaining height */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3" style={{ minHeight: 0 }}>
            {showHelp ? (
              <VoiceCommandsHelp />
            ) : chat.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Спроси или поручи — я выполню действие или отвечу по твоим данным.
                    <br />
                    <span className="text-[11px] opacity-70">Голосом — продиктуй в Telegram-боте.</span>
                  </p>
                </div>
              </div>
            ) : (
              <>
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === 'user'
                        ? 'ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--ds-accent)] text-white px-3.5 py-2 text-sm whitespace-pre-wrap'
                        : 'mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/50 px-3.5 py-2 text-sm whitespace-pre-wrap'
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
              </>
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
              }}
              rows={1}
              placeholder="Напиши команду или вопрос…"
              className="flex-1 resize-none rounded-lg border bg-background px-3.5 py-3 text-sm leading-snug outline-none focus:border-[var(--ds-accent)] min-h-[48px] max-h-[140px]"
              disabled={sending}
            />
            <button
              onClick={sendChat}
              disabled={sending || !input.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--ds-accent)] text-white disabled:opacity-40 transition-opacity"
              aria-label="Отправить"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </section>

        {/* Birthdays — clients + partners merged. 1 col, scrolls internally */}
        <div className="flex flex-col rounded-xl border bg-card p-4 lg:col-span-1 overflow-hidden min-h-0">
          <div className="flex items-center mb-3 shrink-0">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Cake className="w-3.5 h-3.5" />
              Ближайшие ДР
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
          {upcomingBirthdays.length === 0 ? (
            <EmptyState
              icon={<Cake className="w-5 h-5" />}
              title="Нет ближайших ДР"
              description="В ближайшие 30 дней — никого."
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
                  <li key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-sm">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
                      <Cake className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium">{c.full_name}</p>
                        {isPartner && (
                          <span className="shrink-0 rounded-full border border-[var(--ds-accent)]/30 bg-[var(--ds-accent-soft)] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-[var(--ds-accent)]">
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
      </motion.div>
    </div>
  );
}

/** Cheat-sheet of voice + text commands the master can use. */
function VoiceCommandsHelp() {
  const groups: Array<{ title: string; items: Array<{ ex: string; out: string }> }> = [
    {
      title: 'Напоминания',
      items: [
        { ex: '«Напомни завтра в 10 позвонить Анне»', out: 'создаст напоминание с датой' },
        { ex: '«Напомни в пятницу купить краску»', out: 'напоминание без привязки к клиенту' },
      ],
    },
    {
      title: 'Записи клиентов',
      items: [
        { ex: '«Запиши Машу на стрижку в пятницу 15:00»', out: 'создаст запись в календаре' },
        { ex: '«Отмени Колю завтра»', out: 'отменит ближайшую запись клиента' },
        { ex: '«Перенеси Иру с пятницы на субботу 14:00»', out: 'перенесёт запись' },
        { ex: '«Новая клиентка Марина, телефон 0671234567»', out: 'добавит клиента в базу' },
      ],
    },
    {
      title: 'Обновление карточки клиента',
      items: [
        { ex: '«Добавь Таисии день рождения 5 марта 1998»', out: 'запишет дату рождения' },
        { ex: '«У Анны теперь телефон 0671234567»', out: 'обновит телефон' },
        { ex: '«У Марии аллергия на аммиак и перекись»', out: 'запишет аллергены' },
        { ex: '«У Даши чихуахуа Буся»', out: 'добавит свободную заметку' },
      ],
    },
    {
      title: 'Финансы',
      items: [
        { ex: '«Потратил 500 на краску»', out: 'разовая трата' },
        { ex: '«Аренда 5000 каждое 1-е число»', out: 'постоянный расход, cron добавляет сам' },
        { ex: '«Сегодня Аня стрижка 1200, Маша окрашивание 2500»', out: 'несколько приходов за день' },
      ],
    },
    {
      title: 'Склад',
      items: [
        { ex: '«Списал 200 мл краски»', out: 'уменьшит остаток на складе' },
      ],
    },
    {
      title: 'Заказ поставщику',
      items: [
        { ex: '«Заказать у Ивана 5 кг краски и 3 щётки, отправить на телеграм»', out: 'создаст заказ, кнопки Telegram/Email/PDF' },
      ],
    },
    {
      title: 'Вопросы',
      items: [
        { ex: '«Сколько заработал сегодня?»', out: 'AI ответит по твоим данным' },
        { ex: '«Кто спящий клиент?»', out: 'список клиентов, которые давно не были' },
        { ex: '«Топ услуга этого месяца»', out: 'ранжирование по выручке' },
      ],
    },
  ];

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground leading-relaxed">
        AI распознаёт свободную речь. Эти примеры показывают форматы, которые он точно поймёт —
        перефразировка работает. Голосом можно отправить боту в Telegram, текстом — прямо в это поле.
      </p>
      {groups.map((g) => (
        <div key={g.title}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            {g.title}
          </p>
          <ul className="space-y-1.5">
            {g.items.map((it, i) => (
              <li key={i} className="rounded-lg bg-muted/30 px-3 py-2 leading-snug">
                <span className="text-foreground">{it.ex}</span>
                <span className="text-muted-foreground"> — {it.out}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// BookingStatTile + ACCENT_BG moved alongside the lifecycle stats block to /stats.
