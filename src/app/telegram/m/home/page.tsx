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
import { Clock, Coins, CalendarDays, CheckCircle2, PlayCircle, Hourglass } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { getCached, setCached } from '@/lib/miniapp/cache';

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
