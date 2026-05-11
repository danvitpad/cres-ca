/** --- YAML
 * name: MasterMiniAppHome
 * description: Master Mini App «Главная» — Open Design alignment.
 *              Header «Доброго дня, [имя]» + KPI strip (Доход дня | Завершено |
 *              Впереди) с accent-left на доходе + timeline сегодняшних записей
 *              со статус-бейджами. Source данных — /api/telegram/m/calendar
 *              (тот же что и /telegram/m/calendar страница).
 * created: 2026-04-13
 * updated: 2026-05-11
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Coins, CalendarDays, CheckCircle2, PlayCircle, Hourglass, Cake, Lightbulb } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { MobilePage, PageHeader, AvatarCircle } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { getCached, setCached } from '@/lib/miniapp/cache';
import { createClient } from '@/lib/supabase/client';

type Status = 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'cancelled_by_client';

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: Status;
  price: number;
  client_name: string;
  service_name: string;
  duration_min: number;
}

interface CachedHome {
  rows: Appointment[];
  fetchedAt: number;
}

const I18N: Record<MiniAppLang, {
  morningHi: string; dayHi: string; eveningHi: string; nightHi: string;
  kpiRevenue: string; kpiCompleted: string; kpiUpcoming: string;
  recordsWord: (n: number) => string;
  todayTimeline: string;
  emptyTitle: string; emptyText: string;
  status: Record<Status, string>;
  now: string;
  openCalendar: string;
  defaultClient: string;
}> = {
  uk: {
    morningHi: 'Доброго ранку', dayHi: 'Доброго дня', eveningHi: 'Доброго вечора', nightHi: 'Доброї ночі',
    kpiRevenue: 'Дохід дня', kpiCompleted: 'Завершено', kpiUpcoming: 'Попереду',
    recordsWord: (n) => {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 'запис';
      if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'записи';
      return 'записів';
    },
    todayTimeline: 'Сьогодні',
    emptyTitle: 'Сьогодні записів немає',
    emptyText: 'Додай запис у календарі або чекай онлайн-бронювання.',
    status: {
      booked: 'Заплановано', confirmed: 'Підтверджено', in_progress: 'Зараз',
      completed: 'Завершено', cancelled: 'Скасовано',
      cancelled_by_client: 'Скасував клієнт', no_show: 'Не прийшов',
    },
    now: 'Зараз',
    openCalendar: 'Відкрити календар',
    defaultClient: 'Клієнт',
  },
  ru: {
    morningHi: 'Доброе утро', dayHi: 'Добрый день', eveningHi: 'Добрый вечер', nightHi: 'Доброй ночи',
    kpiRevenue: 'Доход дня', kpiCompleted: 'Завершено', kpiUpcoming: 'Впереди',
    recordsWord: (n) => {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 'запись';
      if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'записи';
      return 'записей';
    },
    todayTimeline: 'Сегодня',
    emptyTitle: 'Сегодня записей нет',
    emptyText: 'Добавь запись в календаре или жди онлайн-бронирования.',
    status: {
      booked: 'Запланировано', confirmed: 'Подтверждено', in_progress: 'Сейчас',
      completed: 'Завершено', cancelled: 'Отменено',
      cancelled_by_client: 'Отменил клиент', no_show: 'Не пришёл',
    },
    now: 'Сейчас',
    openCalendar: 'Открыть календарь',
    defaultClient: 'Клиент',
  },
  en: {
    morningHi: 'Good morning', dayHi: 'Good afternoon', eveningHi: 'Good evening', nightHi: 'Good night',
    kpiRevenue: 'Daily revenue', kpiCompleted: 'Completed', kpiUpcoming: 'Upcoming',
    recordsWord: () => 'records',
    todayTimeline: 'Today',
    emptyTitle: 'No appointments today',
    emptyText: 'Add a booking in the calendar or wait for online bookings.',
    status: {
      booked: 'Scheduled', confirmed: 'Confirmed', in_progress: 'In progress',
      completed: 'Completed', cancelled: 'Cancelled',
      cancelled_by_client: 'Cancelled by client', no_show: 'No-show',
    },
    now: 'Now',
    openCalendar: 'Open calendar',
    defaultClient: 'Client',
  },
};

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch { /* ignore */ }
  return null;
}

export default function MasterMiniAppHome() {
  const { fullName, userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const firstName = fullName?.trim().split(/\s+/)[0] ?? '';

  const cacheKey = userId ? `m-home:${userId}` : null;
  const initial = cacheKey ? getCached<CachedHome>(cacheKey) : undefined;
  const [rows, setRows] = useState<Appointment[]>(initial?.rows ?? []);
  const [loaded, setLoaded] = useState(!!initial);
  const [birthdays, setBirthdays] = useState<Array<{ id: string; full_name: string; date_of_birth: string }>>([]);

  // Load today via /api/telegram/m/calendar (same endpoint as /m/calendar page)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoaded(true); return; }
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const res = await fetch('/api/telegram/m/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, day_iso: today.toISOString() }),
      });
      if (!res.ok || cancelled) { setLoaded(true); return; }
      const json = await res.json();
      type Row = {
        id: string; starts_at: string; ends_at: string; status: Status;
        price: number | null;
        client: { profile: { full_name: string } | { full_name: string }[] | null } | null;
        service: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
      };
      const mapped: Appointment[] = (json.appointments as Row[]).map((r) => {
        const cp = Array.isArray(r.client?.profile) ? r.client?.profile[0] : r.client?.profile;
        const svc = Array.isArray(r.service) ? r.service[0] : r.service;
        return {
          id: r.id,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          status: r.status,
          price: Number(r.price ?? 0),
          client_name: cp?.full_name ?? t.defaultClient,
          service_name: svc?.name ?? '—',
          duration_min: Number(svc?.duration_minutes ?? 0),
        };
      });
      if (cancelled) return;
      setRows(mapped);
      if (cacheKey) setCached<CachedHome>(cacheKey, { rows: mapped, fetchedAt: Date.now() });
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [cacheKey, t.defaultClient]);

  // Load birthdays (отдельный fetch — не блокирует основной timeline)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // Получаем master_id через profile_id (userId)
      const { data: masterRow } = await supabase
        .from('masters')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle<{ id: string }>();
      if (cancelled || !masterRow?.id) return;
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, date_of_birth')
        .eq('master_id', masterRow.id)
        .not('date_of_birth', 'is', null);
      if (cancelled || !data) return;
      setBirthdays(data as Array<{ id: string; full_name: string; date_of_birth: string }>);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return t.nightHi;
    if (h < 12) return t.morningHi;
    if (h < 18) return t.dayHi;
    return t.eveningHi;
  }, [t]);

  const now = Date.now();
  const completed = useMemo(() => rows.filter((r) => r.status === 'completed'), [rows]);
  const upcoming = useMemo(
    () => rows.filter((r) => {
      if (r.status === 'cancelled' || r.status === 'cancelled_by_client' || r.status === 'no_show' || r.status === 'completed') return false;
      return new Date(r.starts_at).getTime() > now;
    }),
    [rows, now],
  );
  const revenue = useMemo(
    () => completed.reduce((s, r) => s + (r.price || 0), 0),
    [completed],
  );

  const visibleRows = useMemo(
    () => rows
      .filter((r) => r.status !== 'cancelled' && r.status !== 'cancelled_by_client')
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [rows],
  );

  // Upcoming birthdays — ближайшие 5 в окне 90 дней
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const computed = birthdays
      .map((b) => {
        const birth = new Date(b.date_of_birth);
        const year = today.getFullYear();
        let nextBd = new Date(year, birth.getMonth(), birth.getDate());
        if (nextBd < today) nextBd = new Date(year + 1, birth.getMonth(), birth.getDate());
        const daysUntil = Math.round((nextBd.getTime() - today.getTime()) / 86400000);
        const age = nextBd.getFullYear() - birth.getFullYear();
        return { ...b, daysUntil, age, nextBd };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
    return computed.filter((b) => b.daysUntil <= 90).slice(0, 5);
  }, [birthdays]);

  // AI tip — динамическая подсказка из данных дня
  const aiTip = useMemo(() => {
    if (upcoming.length > 0) {
      const nxt = upcoming[0];
      const d = new Date(nxt.starts_at);
      const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return `Следующая запись в ${time} — ${nxt.client_name}. Готово ли всё?`;
    }
    const birthdayToday = upcomingBirthdays.find((b) => b.daysUntil === 0);
    if (birthdayToday) {
      return `У ${birthdayToday.full_name} сегодня день рождения! Поздравь и предложи запись.`;
    }
    const birthdaySoon = upcomingBirthdays.find((b) => b.daysUntil > 0 && b.daysUntil <= 7);
    if (birthdaySoon) {
      return `У ${birthdaySoon.full_name} ДР через ${birthdaySoon.daysUntil} дн. — поздравь и предложи запись.`;
    }
    if (rows.length === 0 && loaded) {
      return 'Сегодня свободный день. Хороший момент написать спящим клиентам — предложи запись.';
    }
    return null;
  }, [upcoming, upcomingBirthdays, rows.length, loaded]);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'uk-UA', { maximumFractionDigits: 0 }).format(n) + ' ₴';
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <PageHeader
          title={firstName ? `${greeting}, ${firstName}` : greeting}
          subtitle={new Date().toLocaleDateString(
            lang === 'uk' ? 'uk-UA' : lang === 'ru' ? 'ru-RU' : 'en-US',
            { weekday: 'long', day: 'numeric', month: 'long' },
          )}
          right={fullName ? <AvatarCircle url={null} name={fullName} size={44} /> : undefined}
        />

        {/* KPI Strip — 3 cards, accent-left на доходе дня */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          padding: `0 ${PAGE_PADDING_X}px`,
        }}>
          <KpiCard label={t.kpiRevenue} value={fmtMoney(revenue)} accent />
          <KpiCard label={t.kpiCompleted} value={String(completed.length)} sub={t.recordsWord(completed.length)} />
          <KpiCard label={t.kpiUpcoming} value={String(upcoming.length)} sub={t.recordsWord(upcoming.length)} />
        </div>

        {/* AI Tip card — Open Design «Нагадування ШИ» */}
        {aiTip && (
          <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
            <div style={{
              display: 'flex',
              gap: 12,
              padding: 14,
              borderRadius: R.md,
              background: T.accentSoft,
              border: `1px solid color-mix(in oklab, ${T.accent} 25%, transparent)`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: R.sm,
                background: T.accent, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Lightbulb size={18} strokeWidth={2.25} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: T.accent,
                  marginBottom: 3,
                }}>
                  Подсказка
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: T.text }}>
                  {aiTip}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline today */}
        <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <h2 style={{ ...TYPE.h2, color: T.text }}>{t.todayTimeline}</h2>
            <Link
              href="/telegram/m/calendar"
              style={{ fontSize: 12, fontWeight: 600, color: T.accent, textDecoration: 'none' }}
            >
              {t.openCalendar} →
            </Link>
          </div>

          {!loaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  height: 76, borderRadius: R.md,
                  background: T.surfaceElevated, opacity: 0.5,
                }} />
              ))}
            </div>
          ) : visibleRows.length === 0 ? (
            <div style={{
              padding: 24,
              borderRadius: R.md,
              background: T.surface,
              border: `1px solid ${T.borderSubtle}`,
              textAlign: 'center',
              boxShadow: SHADOW.card,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: R.pill,
                background: T.surfaceElevated, color: T.textTertiary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <CalendarDays size={20} />
              </div>
              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{t.emptyTitle}</p>
              <p style={{ ...TYPE.caption, marginTop: 4 }}>{t.emptyText}</p>
            </div>
          ) : (
            <ul style={{
              listStyle: 'none', margin: 0, padding: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {visibleRows.map((r) => {
                const startMs = new Date(r.starts_at).getTime();
                const endMs = new Date(r.ends_at).getTime();
                const isCurrent = r.status === 'in_progress' || (startMs <= now && endMs >= now && r.status !== 'completed');
                return (
                  <li key={r.id}>
                    <Link
                      href={`/telegram/m/calendar?id=${r.id}`}
                      style={{
                        display: 'flex', gap: 12, padding: 14,
                        background: T.surface,
                        border: `1px solid ${isCurrent ? T.accent : T.borderSubtle}`,
                        borderRadius: R.md,
                        textDecoration: 'none',
                        color: T.text,
                        boxShadow: isCurrent ? SHADOW.cardHover : SHADOW.card,
                        transition: 'box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        minWidth: 46, gap: 2,
                      }}>
                        <span style={{
                          fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                          fontVariantNumeric: 'tabular-nums',
                          color: isCurrent ? T.accent : T.text,
                        }}>
                          {fmtTime(r.starts_at)}
                        </span>
                        <span style={{ fontSize: 11, color: T.textTertiary }}>
                          {r.duration_min}m
                        </span>
                      </div>
                      <div style={{
                        width: 1, alignSelf: 'stretch',
                        background: isCurrent ? T.accent : T.borderSubtle,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          ...TYPE.bodyStrong, color: T.text, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.client_name}
                        </p>
                        <p style={{
                          ...TYPE.caption, margin: '2px 0 0',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.service_name}
                        </p>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                          flexWrap: 'wrap',
                        }}>
                          {r.price > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 12, fontWeight: 700, color: T.text,
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              <Coins size={11} strokeWidth={2.25} />
                              {fmtMoney(r.price)}
                            </span>
                          )}
                          <StatusBadge status={r.status} isCurrent={isCurrent} t={t} />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Ближайшие ДР */}
        {upcomingBirthdays.length > 0 && (
          <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
            <h2 style={{
              ...TYPE.h2, color: T.text, marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Cake size={18} color={T.accent} strokeWidth={2} />
              Ближайшие ДР
            </h2>
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {upcomingBirthdays.map((b) => {
                const whenLabel =
                  b.daysUntil === 0 ? 'сегодня' :
                  b.daysUntil === 1 ? 'завтра' :
                  `через ${b.daysUntil} дн.`;
                const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                const dateLabel = `${b.nextBd.getDate()} ${monthNames[b.nextBd.getMonth()]}`;
                const ageLabel = b.age % 10 === 1 && b.age % 100 !== 11 ? 'год' :
                  b.age % 10 >= 2 && b.age % 10 <= 4 && (b.age % 100 < 10 || b.age % 100 >= 20) ? 'года' : 'лет';
                return (
                  <li key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 12, borderRadius: R.md,
                    background: T.surface, border: `1px solid ${T.borderSubtle}`,
                    boxShadow: SHADOW.card,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: R.pill,
                      background: T.accentSoft, color: T.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Cake size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        ...TYPE.bodyStrong, color: T.text, margin: 0,
                        fontSize: 13.5,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {b.full_name}
                      </p>
                      <p style={{ ...TYPE.caption, margin: '2px 0 0', fontSize: 11 }}>
                        {dateLabel} · {b.age} {ageLabel} · {whenLabel}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div style={{ height: 8 }} />
      </motion.div>
    </MobilePage>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      padding: 14,
      borderRadius: R.md,
      background: T.surface,
      border: `1px solid ${T.borderSubtle}`,
      borderLeft: accent ? `3px solid ${T.accent}` : undefined,
      boxShadow: SHADOW.card,
      fontVariantNumeric: 'tabular-nums',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: T.textTertiary,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
        color: T.text, marginTop: 6, lineHeight: 1.1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, isCurrent, t }: { status: Status; isCurrent: boolean; t: typeof I18N['ru'] }) {
  const isDone = status === 'completed';
  const Icon = isCurrent ? PlayCircle : isDone ? CheckCircle2 : Hourglass;
  const label = isCurrent ? t.now : t.status[status];
  const bg = isCurrent ? T.accentSoft : isDone ? T.successSoft : T.surfaceElevated;
  const color = isCurrent ? T.accent : isDone ? T.success : T.textSecondary;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: R.pill,
      background: bg, color,
      fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em',
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}
