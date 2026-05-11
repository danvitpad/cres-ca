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
import { MobilePage } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { getCached, setCached } from '@/lib/miniapp/cache';
import { createClient } from '@/lib/supabase/client';
import '@/styles/od-master-dashboard.css';

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

  // Время-диапазон рабочего дня по факту записей: первое начало → последнее
  // окончание. Используется в section-header «09:00–19:00 · 4 записи»
  // (Open Design master-dashboard mobile). Если записей нет — null.
  const dayRange = useMemo(() => {
    if (visibleRows.length === 0) return null;
    const first = visibleRows[0];
    const last = visibleRows[visibleRows.length - 1];
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };
    return `${fmt(first.starts_at)}–${fmt(last.ends_at)}`;
  }, [visibleRows]);

  // Гэп = разрыв ≥ 30 минут от конца предыдущего визита до начала следующего.
  // Между такими визитами рендерим тонкую горизонтальную линию с подписью
  // «10:00 · 11:00» (как в OD master-dashboard mobile). Без гэпа клиент
  // воспринимает день как «один длинный блок» — теряется ощущение пауз.
  type TimelineItem =
    | { kind: 'appt'; appt: Appointment }
    | { kind: 'gap'; from: string; to: string };
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    for (let i = 0; i < visibleRows.length; i++) {
      const cur = visibleRows[i];
      if (i > 0) {
        const prev = visibleRows[i - 1];
        const prevEnd = new Date(prev.ends_at).getTime();
        const curStart = new Date(cur.starts_at).getTime();
        const gapMin = (curStart - prevEnd) / 60000;
        if (gapMin >= 30) {
          const fmt = (ms: number) => {
            const d = new Date(ms);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          };
          out.push({ kind: 'gap', from: fmt(prevEnd), to: fmt(curStart) });
        }
      }
      out.push({ kind: 'appt', appt: cur });
    }
    return out;
  }, [visibleRows]);

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
    <MobilePage className="od-master-dashboard">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ padding: `8px ${PAGE_PADDING_X}px 0` }}
      >
        {/* Литерально .mobile-header из OD master-dashboard.html (два
            .mobile-greeting на двух строках: «Доброго дня,» / «Имя!»).
            Avatar справа не рендерим — глобальный MiniAppHeaderAvatar
            уже сидит фикс top-right. */}
        <div className="mobile-header card-enter" style={{ ['--i' as 'i']: 0 } as React.CSSProperties}>
          <div>
            <div className="mobile-greeting">{greeting},</div>
            {firstName && <div className="mobile-greeting">{firstName}!</div>}
          </div>
        </div>

        {/* Литерально .mobile-kpi-strip — 3 карточки. Revenue с .kpi-success
            (зелёный левый border). */}
        <div className="mobile-kpi-strip">
          <div className="mobile-kpi-card kpi-success card-enter" style={{ ['--i' as 'i']: 1 } as React.CSSProperties}>
            <div className="mobile-kpi-label">{t.kpiRevenue}</div>
            <div className="mobile-kpi-value">{fmtMoney(revenue)}</div>
            <div className="mobile-kpi-sub">{t.recordsWord(completed.length)}</div>
          </div>
          <div className="mobile-kpi-card card-enter" style={{ ['--i' as 'i']: 2 } as React.CSSProperties}>
            <div className="mobile-kpi-label">{t.kpiCompleted}</div>
            <div className="mobile-kpi-value">{completed.length}</div>
            <div className="mobile-kpi-sub">{t.recordsWord(completed.length)}</div>
          </div>
          <div className="mobile-kpi-card card-enter" style={{ ['--i' as 'i']: 3 } as React.CSSProperties}>
            <div className="mobile-kpi-label">{t.kpiUpcoming}</div>
            <div className="mobile-kpi-value">{upcoming.length}</div>
            <div className="mobile-kpi-sub">{t.recordsWord(upcoming.length)}</div>
          </div>
        </div>

        {/* AI Tip — литерально .ai-tip-card / .ai-tip-icon / .ai-tip-label /
            .ai-tip-text из OD. Иконка Lightbulb (Sparkles запрещён правилом
            CLAUDE.md). */}
        {aiTip && (
          <div className="ai-tip-card card-enter" style={{ ['--i' as 'i']: 4 } as React.CSSProperties}>
            <div className="ai-tip-icon">
              <Lightbulb strokeWidth={2.25} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ai-tip-label">{lang === 'uk' ? 'Нагадування' : lang === 'en' ? 'Reminder' : 'Подсказка'}</div>
              <div className="ai-tip-text">{aiTip}</div>
            </div>
          </div>
        )}

        {/* Section Title — литерально .section-title / .section-title-muted */}
        <div className="section-title card-enter" style={{ ['--i' as 'i']: 5 } as React.CSSProperties}>
          <span>{dayRange ?? t.todayTimeline}</span>
          {visibleRows.length > 0 ? (
            <span className="section-title-muted">
              {visibleRows.length} {t.recordsWord(visibleRows.length)}
            </span>
          ) : (
            <Link
              href="/telegram/m/calendar"
              className="section-title-muted"
              style={{ textDecoration: 'none', color: 'var(--m-accent)' }}
            >
              {t.openCalendar} →
            </Link>
          )}
        </div>

        {!loaded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                height: 76, borderRadius: 12,
                background: 'var(--m-surface-elevated)', opacity: 0.5,
              }} />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div style={{
            padding: 24,
            borderRadius: 12,
            background: 'var(--m-surface)',
            border: `1px solid var(--m-border)`,
            textAlign: 'center',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--m-surface-elevated)', color: 'var(--m-text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <CalendarDays size={20} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--m-text)', margin: 0 }}>{t.emptyTitle}</p>
            <p style={{ fontSize: 12, color: 'var(--m-text-tertiary)', marginTop: 4 }}>{t.emptyText}</p>
          </div>
        ) : (
          /* Литерально .mobile-appt-list — flex column gap:8px.
             Внутри .mobile-appt-card / .mobile-appt-card.current с time-col,
             divider, body (client / service / meta + badge). Между не
             соседними визитами — .time-gap (line + label). */
          <div className="mobile-appt-list">
            {timelineItems.map((item, idx) => {
              if (item.kind === 'gap') {
                return (
                  <div className="time-gap" key={`gap-${idx}`}>
                    <div className="time-gap-line" />
                    <span className="time-gap-label">{item.from} · {item.to}</span>
                    <div className="time-gap-line" />
                  </div>
                );
              }
              const r = item.appt;
              const startMs = new Date(r.starts_at).getTime();
              const endMs = new Date(r.ends_at).getTime();
              const isCurrent = r.status === 'in_progress' || (startMs <= now && endMs >= now && r.status !== 'completed');
              return (
                <Link
                  key={r.id}
                  href={`/telegram/m/calendar?id=${r.id}`}
                  className={`mobile-appt-card card-enter${isCurrent ? ' current' : ''}`}
                  style={{ ['--i' as 'i']: 6 + idx } as React.CSSProperties}
                >
                  <div className="appt-time-col">
                    <div className="appt-time" style={isCurrent ? { color: 'var(--m-accent)' } : undefined}>
                      {fmtTime(r.starts_at)}
                    </div>
                  </div>
                  <div className="appt-divider" style={isCurrent ? { background: 'var(--m-accent)' } : undefined} />
                  <div className="appt-body">
                    <div className="appt-client">{r.client_name}</div>
                    <div className="appt-service">{r.service_name}</div>
                    <div className="appt-meta">
                      <span className="appt-duration">
                        <Clock />
                        {r.duration_min} {lang === 'en' ? 'min' : 'мин'}
                      </span>
                      {r.price > 0 && (
                        <span className="appt-price">{fmtMoney(r.price)}</span>
                      )}
                      <StatusBadge status={r.status} isCurrent={isCurrent} t={t} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Ближайшие ДР — наша секция вне OD эталона, сохраняем как есть */}
        {upcomingBirthdays.length > 0 && (
          <div style={{ marginTop: 20 }}>
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

/**
 * Литерально .mobile-kpi-card / .mobile-kpi-label / .mobile-kpi-value /
 * .mobile-kpi-sub из OD master-dashboard.html. accent — добавляет
 * .kpi-success (зелёный left-border).
 */
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`mobile-kpi-card${accent ? ' kpi-success' : ''}`}>
      <div className="mobile-kpi-label">{label}</div>
      <div className="mobile-kpi-value">{value}</div>
      {sub && <div className="mobile-kpi-sub">{sub}</div>}
    </div>
  );
}

/**
 * Литерально .badge / .badge-current / .badge-done / .badge-next из OD
 * master-dashboard.html. Маппинг наших статусов в OD классы:
 *   in_progress / isCurrent → .badge-current («Зараз»)
 *   completed              → .badge-done    («Завершено»)
 *   booked / confirmed      → .badge-next    («Очікує»)
 *   cancelled / no_show     → .badge-next (нейтрально серый)
 */
function StatusBadge({ status, isCurrent, t }: { status: Status; isCurrent: boolean; t: typeof I18N['ru'] }) {
  const isDone = status === 'completed';
  const cls = isCurrent ? 'badge-current' : isDone ? 'badge-done' : 'badge-next';
  const label = isCurrent ? t.now : t.status[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
