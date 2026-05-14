/** --- YAML
 * name: MiniAppActivityPage
 * description: «Активність» клиента — переключение между Список (карточки записей с
 *              chip-фильтром «Майбутні / Минулі») и Календар (месячная сетка с
 *              точками на днях где есть записи, тап → список записей дня).
 *              Подарочные карты и абонементы убраны до момента когда подключим
 *              данные — пустые табы только сбивали.
 * created: 2026-04-13
 * updated: 2026-05-07
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  CalendarDays,
  List,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-mini-app.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { resolveCardDisplay, type SalonRef } from '@/lib/client/display-mode';
import { formatMoney } from '@/lib/format/money';
import {
  MobilePage,
  PageHeader,
  EmptyState,
} from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  title: string;
  viewList: string; viewCalendar: string;
  filterUpcoming: string; filterPast: string;
  noActivity: string; noActivityDesc: string;
  noActivityOnDay: string;
  searchVenues: string;
  weekdaysShort: string[];
  status: Record<string, string>;
  monthsLong: string[];
}> = {
  uk: {
    title: 'Мої записи',
    viewList: 'Список', viewCalendar: 'Календар',
    filterUpcoming: 'Майбутні', filterPast: 'Минулі',
    noActivity: 'Немає записів',
    noActivityDesc: 'Майбутні зустрічі та історія візитів з’являться тут',
    noActivityOnDay: 'У цей день записів немає',
    searchVenues: 'Знайти майстра',
    weekdaysShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
    status: {
      booked: 'Записано', confirmed: 'Підтверджено', in_progress: 'Йде',
      completed: 'Завершено', cancelled: 'Скасовано', cancelled_by_client: 'Скасовано',
      cancelled_by_master: 'Скасовано', no_show: 'Не з\'явився',
    },
    monthsLong: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
  },
  ru: {
    title: 'Мои записи',
    viewList: 'Список', viewCalendar: 'Календарь',
    filterUpcoming: 'Будущие', filterPast: 'Прошедшие',
    noActivity: 'Нет записей',
    noActivityDesc: 'Будущие встречи и история визитов появятся здесь',
    noActivityOnDay: 'В этот день записей нет',
    searchVenues: 'Найти мастера',
    weekdaysShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    status: {
      booked: 'Записан', confirmed: 'Подтверждено', in_progress: 'Идёт',
      completed: 'Завершено', cancelled: 'Отменено', cancelled_by_client: 'Отменено',
      cancelled_by_master: 'Отменено', no_show: 'Не пришёл',
    },
    monthsLong: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  },
  en: {
    title: 'My bookings',
    viewList: 'List', viewCalendar: 'Calendar',
    filterUpcoming: 'Upcoming', filterPast: 'Past',
    noActivity: 'No appointments',
    noActivityDesc: 'Upcoming meetings and visit history will appear here',
    noActivityOnDay: 'No appointments on this day',
    searchVenues: 'Find a master',
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    status: {
      booked: 'Booked', confirmed: 'Confirmed', in_progress: 'In progress',
      completed: 'Completed', cancelled: 'Cancelled', cancelled_by_client: 'Cancelled',
      cancelled_by_master: 'Cancelled', no_show: 'No show',
    },
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};

type SalonEmbed =
  | { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null }
  | null;

function unwrapSalon(s: SalonEmbed | SalonEmbed[] | null | undefined): SalonRef | null {
  if (!s) return null;
  const obj = Array.isArray(s) ? s[0] ?? null : s;
  if (!obj) return null;
  return { id: obj.id, name: obj.name, logo_url: obj.logo_url, city: obj.city, rating: obj.rating };
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  currency: string | null;
  service_name: string;
  service_color: string | null;
  master_id: string | null;
  master_display_name: string | null;
  master_avatar: string | null;
  master_specialization: string | null;
  master_salon_id: string | null;
  salon: SalonRef | null;
}

type View = 'list' | 'calendar';
type Filter = 'upcoming' | 'past';

const STATUS_DONE = ['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'];

function isDoneStatus(s: string): boolean {
  return STATUS_DONE.includes(s);
}

/** YYYY-MM-DD по локальному времени. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MiniAppActivityPage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const cardLabels = {
    masterPlaceholder: lang === 'en' ? 'Master' : lang === 'uk' ? 'Майстер' : 'Мастер',
    salonPlaceholder: lang === 'en' ? 'Salon' : lang === 'uk' ? 'Салон' : 'Салон',
    managerAssigned: lang === 'en'
      ? 'Master will be assigned by admin'
      : lang === 'uk' ? 'Майстра призначить адміністратор' : 'Мастер будет назначен администратором',
  };

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [view, setView] = useState<View>('list');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      const initData = (() => {
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
      })();
      if (!initData) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/telegram/c/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      const data = json.appointments ?? [];
      const rows: AppointmentRow[] = data.map((row: unknown) => {
        const a = row as {
          id: string;
          starts_at: string;
          status: string;
          price: number | null;
          currency: string | null;
          master:
            | {
                id: string | null;
                display_name: string | null;
                avatar_url: string | null;
                specialization: string | null;
                salon_id: string | null;
                profile:
                  | { full_name: string | null; avatar_url: string | null }
                  | { full_name: string | null; avatar_url: string | null }[]
                  | null;
                salon: SalonEmbed | SalonEmbed[];
              }
            | null;
          service: { name: string | null; color: string | null } | { name: string | null; color: string | null }[] | null;
        };
        const master = Array.isArray(a.master) ? a.master[0] ?? null : a.master;
        const masterProfile =
          master && master.profile
            ? ((Array.isArray(master.profile) ? master.profile[0] ?? null : master.profile) as {
                full_name: string | null;
                avatar_url: string | null;
              } | null)
            : null;
        const svc = Array.isArray(a.service) ? a.service[0] ?? null : a.service;
        const salonRaw = master?.salon ?? null;
        return {
          id: a.id,
          starts_at: a.starts_at,
          status: a.status,
          price: Number(a.price ?? 0),
          currency: a.currency ?? 'UAH',
          service_name: svc?.name ?? '—',
          service_color: svc?.color ?? null,
          master_id: master?.id ?? null,
          master_display_name: master?.display_name ?? masterProfile?.full_name ?? null,
          master_avatar: master?.avatar_url ?? masterProfile?.avatar_url ?? null,
          master_specialization: master?.specialization ?? null,
          master_salon_id: master?.salon_id ?? null,
          salon: unwrapSalon(salonRaw as SalonEmbed | SalonEmbed[] | null),
        };
      });
      setAppointments(rows);
      setLoading(false);
    })();
  }, [userId]);

  /** Разделение записей: будущие = !done && start ≥ now-1h. */
  const { upcoming, past, byDay } = useMemo(() => {
    const now = Date.now();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    const map = new Map<string, AppointmentRow[]>();
    for (const a of appointments) {
      const startTs = new Date(a.starts_at).getTime();
      const future = !isDoneStatus(a.status) && startTs >= now - 3600 * 1000;
      if (future) up.push(a); else pa.push(a);
      const key = dayKey(new Date(a.starts_at));
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    up.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    pa.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    // День сортируем по времени внутри
    map.forEach((list) => list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));
    return { upcoming: up, past: pa, byDay: map };
  }, [appointments]);

  const listVisible = filter === 'upcoming' ? upcoming : past;

  return (
    <MobilePage className="od-client-mini-app">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <PageHeader
          title={t.title}
          right={
            <button
              type="button"
              onClick={() => { setView(view === 'list' ? 'calendar' : 'list'); haptic('selection'); }}
              aria-label={view === 'list' ? t.viewCalendar : t.viewList}
              style={{
                width: 36, height: 36, borderRadius: 18,
                border: `1px solid ${T.borderSubtle}`,
                background: T.surface, color: T.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {view === 'list'
                ? <CalendarDays size={16} strokeWidth={2} />
                : <List size={16} strokeWidth={2} />}
            </button>
          }
        />

        <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 88,
                    width: '100%',
                    borderRadius: R.md,
                    background: T.bgSubtle,
                    animation: 'pulse 1.6s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ) : view === 'list' ? (
            <ListView
              filter={filter}
              setFilter={setFilter}
              upcoming={upcoming}
              past={past}
              listVisible={listVisible}
              t={t}
              lang={lang}
              cardLabels={cardLabels}
              haptic={haptic}
            />
          ) : (
            <CalendarView
              calMonth={calMonth}
              setCalMonth={setCalMonth}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              byDay={byDay}
              t={t}
              lang={lang}
              cardLabels={cardLabels}
              haptic={haptic}
            />
          )}
        </div>
      </motion.div>
    </MobilePage>
  );
}

/* ─────────────────── ListView ─────────────────── */

interface ListViewProps {
  filter: Filter;
  setFilter: (f: Filter) => void;
  upcoming: AppointmentRow[];
  past: AppointmentRow[];
  listVisible: AppointmentRow[];
  t: typeof I18N['uk'];
  lang: Lang;
  cardLabels: { masterPlaceholder: string; salonPlaceholder: string; managerAssigned: string };
  haptic: (kind: 'light' | 'selection') => void;
}

function ListView({ filter, setFilter, upcoming, past, listVisible, t, lang, cardLabels, haptic }: ListViewProps) {
  const upcomingCount = upcoming.length;
  const pastCount = past.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Segment toggle Майбутні / Минулі — стиль эталона (.segment) */}
      <div className="segment">
        {(['upcoming', 'past'] as const).map((f) => {
          const active = filter === f;
          const count = f === 'upcoming' ? upcomingCount : pastCount;
          return (
            <button
              key={f}
              type="button"
              className={`segment-btn${active ? ' active' : ''}`}
              onClick={() => { setFilter(f); haptic('selection'); }}
            >
              {f === 'upcoming' ? t.filterUpcoming : t.filterPast} {count}
            </button>
          );
        })}
      </div>

      {listVisible.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon />}
          title={t.noActivity}
          desc={t.noActivityDesc}
          ctaLabel={t.searchVenues}
          ctaHref="/telegram/search"
        />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {listVisible.map((a, i) => (
            <AppointmentCard key={a.id} appt={a} index={i} t={t} lang={lang} cardLabels={cardLabels} haptic={haptic} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────── CalendarView ─────────────────── */

interface CalendarViewProps {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
  byDay: Map<string, AppointmentRow[]>;
  t: typeof I18N['uk'];
  lang: Lang;
  cardLabels: { masterPlaceholder: string; salonPlaceholder: string; managerAssigned: string };
  haptic: (kind: 'light' | 'selection') => void;
}

function CalendarView({ calMonth, setCalMonth, selectedDay, setSelectedDay, byDay, t, lang, cardLabels, haptic }: CalendarViewProps) {
  const monthLabel = `${t.monthsLong[calMonth.getMonth()]} ${calMonth.getFullYear()}`;
  const todayKey = dayKey(new Date());

  // Сетка месяца: понедельник = первый день недели.
  const weeks = useMemo(() => {
    const firstOfMonth = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    // jsDay: 0=Sun..6=Sat — переводим в Mon=0..Sun=6
    const jsDay = firstOfMonth.getDay();
    const offset = jsDay === 0 ? 6 : jsDay - 1;
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - offset);

    const grid: Date[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      grid.push(week);
    }
    return grid;
  }, [calMonth]);

  const selectedAppts = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Месяц + навигация */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => {
            haptic('light');
            setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
            setSelectedDay(null);
          }}
          aria-label="Prev month"
          style={chevronBtnStyle}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ ...TYPE.h3, color: T.text, fontWeight: 700 }}>{monthLabel}</div>
        <button
          onClick={() => {
            haptic('light');
            setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));
            setSelectedDay(null);
          }}
          aria-label="Next month"
          style={chevronBtnStyle}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Шапка недели */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 11, color: T.textTertiary, fontWeight: 600 }}>
        {t.weekdaysShort.map((w) => (
          <div key={w} style={{ textAlign: 'center' }}>{w}</div>
        ))}
      </div>

      {/* Сетка дней */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {week.map((day) => {
              const key = dayKey(day);
              const inMonth = day.getMonth() === calMonth.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              const dayAppts = byDay.get(key) ?? [];
              const hasItems = dayAppts.length > 0;
              // Цвет точки: зелёный если есть будущие, серый если только прошлые
              const now = Date.now();
              const hasUpcoming = dayAppts.some((a) =>
                !isDoneStatus(a.status) && new Date(a.starts_at).getTime() >= now - 3600 * 1000,
              );
              const dotColor = hasUpcoming ? T.accent : T.textTertiary;

              return (
                <button
                  key={key}
                  onClick={() => { haptic('selection'); setSelectedDay(isSelected ? null : key); }}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: R.sm,
                    border: `1px solid ${isSelected ? T.text : 'transparent'}`,
                    background: isSelected ? T.bgSubtle : 'transparent',
                    color: inMonth ? T.text : T.textTertiary,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: isToday ? 800 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    padding: 0,
                    opacity: inMonth ? 1 : 0.45,
                    position: 'relative',
                  }}
                >
                  <span>{day.getDate()}</span>
                  {hasItems && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: dotColor,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Список выбранного дня */}
      {selectedDay && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <div style={{ ...TYPE.caption, color: T.textTertiary, fontWeight: 600 }}>
            {(() => {
              const [y, m, d] = selectedDay.split('-').map(Number);
              const dt = new Date(y, m - 1, d);
              const locale = lang === 'en' ? 'en-GB' : lang === 'uk' ? 'uk-UA' : 'ru-RU';
              return dt.toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'long' });
            })()}
          </div>
          {selectedAppts.length === 0 ? (
            <div style={{
              padding: '20px 16px',
              borderRadius: R.md,
              background: T.bgSubtle,
              color: T.textSecondary,
              fontSize: 13,
              textAlign: 'center',
            }}>
              {t.noActivityOnDay}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedAppts.map((a, i) => (
                <AppointmentCard key={a.id} appt={a} index={i} t={t} lang={lang} cardLabels={cardLabels} haptic={haptic} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const chevronBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: R.pill,
  border: `1px solid ${T.borderSubtle}`,
  background: T.surface,
  color: T.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

/* ─────────────────── AppointmentCard (общая) ─────────────────── */

interface CardProps {
  appt: AppointmentRow;
  index: number;
  t: typeof I18N['uk'];
  lang: Lang;
  cardLabels: { masterPlaceholder: string; salonPlaceholder: string; managerAssigned: string };
  haptic: (kind: 'light' | 'selection') => void;
}

function AppointmentCard({ appt: a, index: i, t, lang, cardLabels, haptic }: CardProps) {
  void List; // отключаем unused-warning, импорт пригодится позже
  const masterRef = a.master_id
    ? {
        id: a.master_id,
        display_name: a.master_display_name,
        avatar_url: a.master_avatar,
        specialization: a.master_specialization,
        salon_id: a.master_salon_id,
      }
    : null;
  const display = resolveCardDisplay(masterRef, a.salon, cardLabels);
  const dateLocale = lang === 'en' ? 'en-GB' : lang === 'uk' ? 'uk-UA' : 'ru-RU';
  const dt = new Date(a.starts_at);
  const dayNum = dt.getDate();
  const monthShort = dt
    .toLocaleDateString(dateLocale, { month: 'short' })
    .replace(/\./g, '');
  const timeStr = dt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  // Статус как в эталоне: upcoming / done / cancelled
  const isDone = STATUS_DONE.includes(a.status);
  const isCancelled = a.status.startsWith('cancelled') || a.status === 'no_show';
  const statusVariant = isCancelled ? 'cancelled' : isDone ? 'done' : 'upcoming';
  const statusLabel = t.status[a.status] ?? t.status.booked;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.02 }}
    >
      <div className="bk-item">
        <Link
          href={`/telegram/activity/${a.id}`}
          onClick={() => haptic('light')}
          className="bk-item-head"
        >
          <div className="bk-date-block">
            <div className="bk-date-day">{dayNum}</div>
            <div className="bk-date-mon">{monthShort}</div>
          </div>
          <div className="bk-info">
            <div className="bk-service">{a.service_name}</div>
            <div className="bk-master">
              {display.primary}
              {display.secondary ? ` · ${display.secondary}` : ''}
            </div>
            <span className={`bk-status ${statusVariant}`}>{statusLabel}</span>
          </div>
          <span className="bk-time">{timeStr}</span>
        </Link>
        {a.price > 0 && (
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--m-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--m-text-secondary, #475569)',
              background: 'var(--m-bg-subtle, #f2f4f7)',
            }}
          >
            <span>{a.service_name}</span>
            <span style={{ fontWeight: 700, color: 'var(--m-text, #0f172a)' }}>
              {formatMoney(a.price, a.currency)}
            </span>
          </div>
        )}
      </div>
    </motion.li>
  );
}

function CalendarDaysIcon() {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: R.md,
        background: `linear-gradient(135deg, ${T.gradientFrom}40 0%, ${T.gradientTo}40 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CalendarDays size={32} color={T.accent} strokeWidth={2} />
    </div>
  );
}

