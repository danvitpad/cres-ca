/** --- YAML
 * name: MasterMiniAppCalendar
 * description: Master Mini App calendar — day timeline with appointments, tap → drawer with quick actions. Flat cards + 1px status strip (Phase 7.2).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Phone,
  User as UserIcon,
  PlayCircle,
  CheckCircle2,
  XCircle,
  UserX,
  Loader2,
  Plus,
  CalendarDays,
  CalendarOff,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { TapButton } from '@/components/miniapp/tap-press';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { HomeScreenBanner } from '@/components/miniapp/home-screen-banner';
import { getCached, setCached, isFresh, invalidateCache } from '@/lib/miniapp/cache';
import { BlockTimeSheet } from '@/components/miniapp/block-time-sheet';

type Status = 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'cancelled_by_client';

const I18N: Record<MiniAppLang, {
  today: string; tomorrow: string; yesterday: string;
  dateLocale: string;
  bookingsCount: (n: number, revenue: string) => string;
  newBooking: string;
  blockTime: string;
  emptyTitle: string; emptyHint: string;
  defaultClient: string;
  clientSection: string; notesSection: string;
  cancel: string; noShow: string;
  exceeded: string; inProgress: string;
  minutes: string;
  riskLabel: Record<'low' | 'medium' | 'high', string>;
  status: Record<Status, string>;
}> = {
  uk: {
    today: 'Сьогодні', tomorrow: 'Завтра', yesterday: 'Вчора',
    dateLocale: 'uk-UA',
    bookingsCount: (n, r) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'запис'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'записи' : 'записів';
      return `${n} ${w} · ${r} ₴`;
    },
    newBooking: 'Новий запис',
    blockTime: 'Заблокувати час',
    emptyTitle: 'Записів немає',
    emptyHint: 'Додай запис вручну або чекай онлайн-бронювання',
    defaultClient: 'Клієнт',
    clientSection: 'Клієнт', notesSection: 'Нотатки',
    cancel: 'Скасувати', noShow: 'Не прийшов',
    exceeded: 'Перевищено', inProgress: 'Йде візит',
    minutes: 'хв',
    riskLabel: { low: 'Низький ризик', medium: 'Середній ризик', high: 'Високий ризик' },
    status: {
      booked: 'Заброньовано', confirmed: 'Підтверджено', in_progress: 'Йде',
      completed: 'Виконано', cancelled: 'Скасовано',
      cancelled_by_client: 'Скасував клієнт', no_show: 'Не прийшов',
    },
  },
  ru: {
    today: 'Сегодня', tomorrow: 'Завтра', yesterday: 'Вчера',
    dateLocale: 'ru-RU',
    bookingsCount: (n, r) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'запись'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'записи' : 'записей';
      return `${n} ${w} · ${r} ₴`;
    },
    newBooking: 'Новая запись',
    blockTime: 'Заблокировать время',
    emptyTitle: 'Записей нет',
    emptyHint: 'Добавь запись вручную или жди онлайн-бронирования',
    defaultClient: 'Клиент',
    clientSection: 'Клиент', notesSection: 'Заметки',
    cancel: 'Отменить', noShow: 'Не пришёл',
    exceeded: 'Превышено', inProgress: 'Идёт визит',
    minutes: 'мин',
    riskLabel: { low: 'Низкий риск', medium: 'Средний риск', high: 'Высокий риск' },
    status: {
      booked: 'Забронировано', confirmed: 'Подтверждено', in_progress: 'Идёт',
      completed: 'Выполнено', cancelled: 'Отменено',
      cancelled_by_client: 'Отменил клиент', no_show: 'Не пришёл',
    },
  },
  en: {
    today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday',
    dateLocale: 'en-US',
    bookingsCount: (n, r) => `${n} ${n === 1 ? 'booking' : 'bookings'} · ${r} ₴`,
    newBooking: 'New booking',
    blockTime: 'Block time',
    emptyTitle: 'No bookings',
    emptyHint: 'Add a booking manually or wait for online bookings',
    defaultClient: 'Client',
    clientSection: 'Client', notesSection: 'Notes',
    cancel: 'Cancel', noShow: 'No-show',
    exceeded: 'Overtime', inProgress: 'Visit in progress',
    minutes: 'min',
    riskLabel: { low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
    status: {
      booked: 'Booked', confirmed: 'Confirmed', in_progress: 'In progress',
      completed: 'Completed', cancelled: 'Cancelled',
      cancelled_by_client: 'Client cancelled', no_show: 'No-show',
    },
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

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: Status;
  price: number;
  notes: string | null;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  service_name: string;
  duration_min: number;
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayHeader(d: Date, t: typeof I18N['ru']) {
  const today = new Date();
  if (isSameDay(d, today)) return t.today;
  if (isSameDay(d, addDays(today, 1))) return t.tomorrow;
  if (isSameDay(d, addDays(today, -1))) return t.yesterday;
  return d.toLocaleDateString(t.dateLocale, { weekday: 'long', day: 'numeric', month: 'long' });
}

const STATUS_META_STYLES: Record<Status, { stripBg: string; chipBg: string; chipColor: string }> = {
  booked: { stripBg: '#3b82f6', chipBg: '#dbeafe', chipColor: '#1d4ed8' },
  confirmed: { stripBg: 'var(--color-accent)', chipBg: T.accentSoft, chipColor: T.accent },
  in_progress: { stripBg: '#f59e0b', chipBg: '#fef3c7', chipColor: '#b45309' },
  completed: { stripBg: '#10b981', chipBg: T.successSoft, chipColor: T.success },
  cancelled: { stripBg: T.border, chipBg: T.bgSubtle, chipColor: T.textTertiary },
  cancelled_by_client: { stripBg: T.border, chipBg: T.bgSubtle, chipColor: T.textTertiary },
  no_show: { stripBg: T.danger, chipBg: T.dangerSoft, chipColor: T.danger },
};

export default function MasterMiniAppCalendar() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const focusId = searchParams.get('id');
  // Кэш-ключ по дню (focusId не влияет на список — он только подсвечивает уже
  // загруженную карточку; разные focusId на одном дне = тот же набор записей).
  const cacheKey = `m-calendar:${day.toISOString().slice(0, 10)}`;
  type CachedDay = { masterId: string | null; rows: Appointment[] };
  const [masterId, setMasterId] = useState<string | null>(() => getCached<CachedDay>(cacheKey)?.masterId ?? null);
  const [rows, setRows] = useState<Appointment[]>(() => getCached<CachedDay>(cacheKey)?.rows ?? []);
  // Loading=true только если кэша нет ИЛИ он несвежий и пустой. Если есть кэш —
  // рендерим его сразу, в фоне обновляем без скелета.
  const [loading, setLoading] = useState(() => !getCached<CachedDay>(cacheKey));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const loadDay = useCallback(async () => {
    const hasCache = !!getCached<CachedDay>(cacheKey);
    // Скелет показываем только если данных совсем нет. Если есть — тихий refresh.
    if (!hasCache) setLoading(true);
    const initData = getInitData();
    if (!initData) {
      setLoading(false);
      return;
    }
    const res = await fetch('/api/telegram/m/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, day_iso: day.toISOString(), focus_id: focusId ?? undefined }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    if (json.masterId) setMasterId(json.masterId);
    const data = json.appointments as Array<{
      id: string;
      starts_at: string;
      ends_at: string;
      status: Status;
      price: number | null;
      notes: string | null;
      client_id: string | null;
      client: { profile: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null } | null;
      service: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
    }>;

    // If focus_id was on a different day, jump there
    if (json.focusedDayIso) {
      const focusedDay = startOfDay(new Date(json.focusedDayIso));
      if (!isSameDay(focusedDay, day)) {
        setDay(focusedDay);
        return; // useEffect will re-fire loadDay for that day
      }
    }

    type Row = {
      id: string;
      starts_at: string;
      ends_at: string;
      status: Status;
      price: number | null;
      notes: string | null;
      client_id: string | null;
      client: { profile: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null } | null;
      service: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
    };
    const mapped: Appointment[] = (data as unknown as Row[]).map((r) => {
      const cp = Array.isArray(r.client?.profile) ? r.client?.profile[0] : r.client?.profile;
      const svc = Array.isArray(r.service) ? r.service[0] : r.service;
      return {
        id: r.id,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        status: r.status,
        price: Number(r.price ?? 0),
        notes: r.notes,
        client_id: r.client_id,
        client_name: cp?.full_name ?? t.defaultClient,
        client_phone: cp?.phone ?? null,
        service_name: svc?.name ?? '—',
        duration_min: Number(svc?.duration_minutes ?? 0),
      };
    });
    setRows(mapped);
    setCached<CachedDay>(cacheKey, { masterId: json.masterId ?? null, rows: mapped });
    setLoading(false);
  }, [day, focusId, cacheKey, t.defaultClient]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  // If ?id=X was passed and corresponds to a row in the current day, focus it
  useEffect(() => {
    if (!focusId) return;
    const inList = rows.find((r) => r.id === focusId);
    if (inList) {
      setActiveId(focusId);
    }
    // Cross-day jump is now handled inside loadDay via the API's focusedDayIso response.
  }, [focusId, rows]);

  const active = useMemo(() => rows.find((r) => r.id === activeId) ?? null, [rows, activeId]);

  const [clientRisk, setClientRisk] = useState<'low' | 'medium' | 'high' | null>(null);
  useEffect(() => {
    setClientRisk(null);
    if (!active?.client_id) return;
    const initData = getInitData();
    if (!initData) return;
    fetch(`/api/telegram/m/client-risk?client_id=${active.client_id}`, {
      headers: { 'X-TG-Init-Data': initData },
    })
      .then((r) => r.json())
      .then((d: { risk?: 'low' | 'medium' | 'high' | null }) => setClientRisk(d.risk ?? null))
      .catch(() => {});
  }, [active?.client_id]);

  async function updateStatus(id: string, status: Status, extra: Record<string, unknown> = {}) {
    setActing(true);
    const initData = getInitData();
    const res = initData ? await fetch('/api/telegram/m/appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, id, status, extra }),
    }) : null;
    const error = !res || !res.ok ? { message: 'request_failed' } : null;
    if (!error) {
      haptic('success');
      await loadDay();
      setActiveId(null);
    } else {
      haptic('error');
    }
    setActing(false);
  }

  function onSelect(id: string) {
    haptic('light');
    setActiveId(id);
  }

  function closeDrawer() {
    setActiveId(null);
    if (focusId) {
      router.replace('/telegram/m/calendar');
    }
  }

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'cancelled_by_client' && r.status !== 'no_show');
    const revenue = rows.filter((r) => r.status === 'completed').reduce((a, r) => a + r.price, 0);
    return { count: active.length, revenue };
  }, [rows]);

  if (!ready) {
    return (
      <MobilePage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
        </div>
      </MobilePage>
    );
  }

  // Swipe-навигация по дням: горизонтальный жест влево/вправо
  // переключает день вперёд/назад. Срабатывает после ≥60px горизонтальной
  // дистанции и только если жест преимущественно горизонтальный
  // (≥1.5×|dy|), чтобы не мешать вертикальному скроллу.
  const swipeStart = { x: 0, y: 0, t: 0 };
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    swipeStart.x = t.clientX;
    swipeStart.y = t.clientY;
    swipeStart.t = Date.now();
  }
  function onTouchEnd(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    if (!t || !swipeStart.t) return;
    const dx = t.clientX - swipeStart.x;
    const dy = t.clientY - swipeStart.y;
    const dt = Date.now() - swipeStart.t;
    if (dt > 600) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
    haptic('light');
    setDay(addDays(day, dx < 0 ? 1 : -1));
  }

  return (
    <MobilePage>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Кнопка «Новая запись» переехала в floating FAB снизу справа —
            раньше она жила в PageHeader.right и перекрывалась кружком аватара
            (тот теперь fixed top-right на каждом табе). */}
        <PageHeader
          title={formatDayHeader(day, t)}
          subtitle={t.bookingsCount(totals.count, totals.revenue.toFixed(0))}
        />

        <div style={{ paddingLeft: PAGE_PADDING_X, paddingRight: PAGE_PADDING_X }}>
          <HomeScreenBanner />
        </div>

        {/* 7-day date strip — Open Design pattern. Tap = jump к дате;
            swipe (touch handler выше) — переход между днями. */}
        <DateStrip
          day={day}
          locale={t.dateLocale}
          onPick={(d) => { haptic('selection'); setDay(d); }}
          onJumpToday={() => { haptic('selection'); setDay(startOfDay(new Date())); }}
          todayLabel={t.today}
        />

        {/* Appointments list */}
        <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 80, borderRadius: R.md, background: T.bgSubtle }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                background: T.surface,
                border: `1px dashed ${T.border}`,
                borderRadius: R.md,
              }}
            >
              <div
                style={{
                  margin: '0 auto',
                  width: 56,
                  height: 56,
                  borderRadius: R.md,
                  background: `linear-gradient(135deg, ${T.gradientFrom}40, ${T.gradientTo}40)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarDays size={26} color={T.accent} strokeWidth={2} />
              </div>
              <p style={{ ...TYPE.bodyStrong, color: T.text, marginTop: 14 }}>{t.emptyTitle}</p>
              <p style={{ ...TYPE.caption, marginTop: 4 }}>
                {t.emptyHint}
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r, i) => {
                const meta = { ...STATUS_META_STYLES[r.status], label: t.status[r.status] };
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <TapButton
                      onClick={() => onSelect(r.id)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        padding: '14px 14px 14px 18px',
                        borderRadius: R.md,
                        background: T.surface,
                        border: `1px solid ${T.borderSubtle}`,
                        boxShadow: SHADOW.card,
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 12,
                          bottom: 12,
                          width: 4,
                          borderRadius: '0 4px 4px 0',
                          background: meta.stripBg,
                        }}
                      />
                      <div
                        style={{
                          width: 58,
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          background: T.bgSubtle,
                          borderRadius: R.sm,
                          padding: '8px 4px',
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                          {new Date(r.starts_at).toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: 10, color: T.textTertiary, marginTop: 3 }}>
                          {r.duration_min} {t.minutes}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.service_name}
                        </p>
                        <p style={{ ...TYPE.caption, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.client_name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: meta.chipBg,
                              color: meta.chipColor,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {meta.label}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>
                            {r.price.toFixed(0)} ₴
                          </span>
                        </div>
                      </div>
                    </TapButton>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        {/* FAB — новый запись (Open Design pattern) */}
        <Link
          href="/telegram/m/slot/new"
          onClick={() => haptic('light')}
          aria-label={t.newBooking}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))',
            zIndex: 40,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: T.accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35), 0 4px 12px rgba(0,0,0,0.12)',
            textDecoration: 'none',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </Link>

        {/* Drawer */}
        <AnimatePresence>
          {active && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeDrawer}
                style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,10,12,0.5)', backdropFilter: 'blur(2px)' }}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                style={{
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 70,
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  background: T.surface,
                  borderRadius: `${R.lg}px ${R.lg}px 0 0`,
                  padding: `12px ${PAGE_PADDING_X}px calc(2rem + env(safe-area-inset-bottom, 0px))`,
                  boxShadow: SHADOW.elevated,
                }}
              >
                <div style={{ margin: '0 auto 16px', width: 40, height: 4, borderRadius: 999, background: T.border }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: STATUS_META_STYLES[active.status].chipBg,
                        color: STATUS_META_STYLES[active.status].chipColor,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_META_STYLES[active.status].stripBg }} />
                      {t.status[active.status]}
                    </span>
                    <h2 style={{ ...TYPE.h2, color: T.text, marginTop: 8, marginBottom: 0 }}>{active.service_name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, ...TYPE.body, color: T.textSecondary }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} />
                        {new Date(active.starts_at).toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(active.ends_at).toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span style={{ color: T.textTertiary }}>·</span>
                      <span style={{ fontWeight: 700, color: T.text }}>{active.price.toFixed(0)} ₴</span>
                    </div>
                  </div>

                  {/* Client */}
                  <div style={{ background: T.surfaceElevated, border: `1px solid ${T.borderSubtle}`, borderRadius: R.md, padding: 14 }}>
                    <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase' }}>{t.clientSection}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{active.client_name}</p>
                      {clientRisk && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: clientRisk === 'high' ? T.dangerSoft : clientRisk === 'medium' ? '#fef3c7' : T.successSoft,
                          color: clientRisk === 'high' ? T.danger : clientRisk === 'medium' ? '#b45309' : T.success,
                        }}>
                          {t.riskLabel[clientRisk]}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {active.client_phone && (
                        <a
                          href={`tel:${active.client_phone}`}
                          onClick={(e) => {
                            haptic('selection');
                            // В TG WebView обычные tel: ссылки могут блокироваться.
                            // Используем Telegram.WebApp.openLink если есть — он
                            // отдаёт URL в системе iOS/Android и открывает Phone app.
                            // Fallback на default behavior через href.
                            const w = window as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } };
                            const openLink = w.Telegram?.WebApp?.openLink;
                            if (openLink) {
                              e.preventDefault();
                              try { openLink(`tel:${active.client_phone}`); } catch { window.location.href = `tel:${active.client_phone}`; }
                            }
                          }}
                          style={{
                            flex: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '10px 14px',
                            borderRadius: R.md,
                            border: `1px solid ${T.border}`,
                            background: T.surface,
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <Phone size={14} /> {active.client_phone}
                        </a>
                      )}
                      {active.client_id && (
                        <Link
                          href={`/telegram/m/clients/${active.client_id}`}
                          onClick={() => haptic('light')}
                          style={{
                            width: 44,
                            height: 44,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: R.md,
                            border: `1px solid ${T.border}`,
                            background: T.surface,
                            color: T.text,
                            textDecoration: 'none',
                          }}
                        >
                          <UserIcon size={16} />
                        </Link>
                      )}
                    </div>
                  </div>

                  {active.notes && (
                    <div style={{ background: T.surfaceElevated, border: `1px solid ${T.borderSubtle}`, borderRadius: R.md, padding: 14 }}>
                      <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase' }}>{t.notesSection}</p>
                      <p style={{ ...TYPE.body, color: T.text, marginTop: 4, whiteSpace: 'pre-wrap' }}>{active.notes}</p>
                    </div>
                  )}

                  {active.status === 'in_progress' && (
                    <ServiceTimer
                      startsAt={active.starts_at}
                      endsAt={active.ends_at}
                      labels={{ exceeded: t.exceeded, inProgress: t.inProgress }}
                    />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Кнопки «Начать визит» / «Завершить» убраны.
                        С коммита 02.05 включился cron auto-complete:
                        каждый час записи у которых ends_at прошёл ≥30 минут
                        назад автоматически переводятся в 'completed'.
                        Мастеру не нужно ничего нажимать вручную — если
                        запись прошла и не была отменена/перенесена, она
                        считается состоявшейся.
                        Если нужно отменить уже завершённую — можно через
                        историю записей (отмена → запись уйдёт из отчётов
                        по доходам). */}
                    {(active.status === 'booked' || active.status === 'confirmed') && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() =>
                            updateStatus(active.id, 'cancelled', {
                              cancelled_at: new Date().toISOString(),
                              cancelled_by: userId,
                              cancellation_reason: 'master_miniapp',
                            })
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '12px',
                            borderRadius: R.md,
                            border: `1px solid ${T.border}`,
                            background: T.surface,
                            color: T.textSecondary,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            opacity: acting ? 0.5 : 1,
                          }}
                        >
                          <XCircle size={14} /> {t.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => updateStatus(active.id, 'no_show')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '12px',
                            borderRadius: R.md,
                            border: `1px solid ${T.danger}30`,
                            background: T.dangerSoft,
                            color: T.danger,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            opacity: acting ? 0.5 : 1,
                          }}
                        >
                          <UserX size={14} /> {t.noShow}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Floating «Заблокировать» — мини-FAB над основным «+».
          Один тап открывает sheet для блокировки времени на текущий день. */}
      <button
        type="button"
        onClick={() => { haptic('selection'); setBlockOpen(true); }}
        aria-label={t.blockTime}
        title={t.blockTime}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 'calc(164px + env(safe-area-inset-bottom, 0px))',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: T.surface,
          color: T.text,
          border: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          zIndex: 40,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <CalendarOff size={20} strokeWidth={2} />
      </button>

      {/* Floating «+» — раньше жил в PageHeader.right, но кружок аватара (fixed
          top-right на каждом табе) перекрывал его. Перенесён в правый-нижний
          угол, всегда виден, не конкурирует с bottom-nav (nav висит снизу
          по центру). */}
      <Link
        href="/telegram/m/slot/new"
        onClick={() => haptic('selection')}
        aria-label={t.newBooking}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: T.text,
          color: T.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          zIndex: 40,
        }}
      >
        <Plus size={24} strokeWidth={2.4} />
      </Link>

      <BlockTimeSheet
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        date={day}
        defaultTime={(() => {
          const isToday = isSameDay(day, new Date());
          if (!isToday) return '12:00';
          const now = new Date();
          const h = now.getHours();
          const m = Math.ceil(now.getMinutes() / 15) * 15;
          const hh = String(m === 60 ? h + 1 : h).padStart(2, '0');
          const mm = String(m === 60 ? 0 : m).padStart(2, '0');
          return `${hh}:${mm}`;
        })()}
        onSaved={() => {
          invalidateCache(cacheKey);
          loadDay();
        }}
      />
    </MobilePage>
  );
}

function ServiceTimer({ startsAt, endsAt, labels }: { startsAt: string; endsAt: string; labels: { exceeded: string; inProgress: string } }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const total = Math.max(1, end - start);
  const elapsed = Math.max(0, now - start);
  const remaining = end - now;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const overdue = remaining < 0;
  function fmt(ms: number) {
    const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }
  return (
    <div
      style={{
        padding: 14,
        borderRadius: R.md,
        border: `1px solid ${overdue ? `${T.danger}40` : '#f59e0b40'}`,
        background: overdue ? T.dangerSoft : '#fef3c7',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span style={{ color: overdue ? T.danger : '#b45309' }}>
          {overdue ? labels.exceeded : labels.inProgress}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: T.textSecondary }}>
          {fmt(elapsed)} / {fmt(total)}
        </span>
      </div>
      <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: T.bgSubtle, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            background: overdue ? T.danger : '#f59e0b',
            width: `${pct}%`,
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
        {overdue ? `+${fmt(-remaining)}` : fmt(remaining)}
      </div>
    </div>
  );
}

/* ═══ DateStrip — 7-day segmented date picker (Open Design) ═══ */
function DateStrip({
  day,
  locale,
  onPick,
  onJumpToday,
  todayLabel,
}: {
  day: Date;
  locale: string;
  onPick: (d: Date) => void;
  onJumpToday: () => void;
  todayLabel: string;
}) {
  // Окно из 7 дней: 3 до выбранного, выбранный по центру, 3 после
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i - 3));
  const today = startOfDay(new Date());
  const isOnToday = isSameDay(day, today);

  return (
    <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
      {/* Сетка 7 ячеек. Стабильный key=i (а не ISO date) чтобы React не
          размонтировал ячейку при переключении дня — иначе цифры дёргались,
          анимации не было. layoutId="cal-day-pill" даёт плавный shared-layout
          переезд cobalt-подсветки между днями. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
        }}
      >
        {days.map((d, i) => {
          const isSelected = isSameDay(d, day);
          const isToday = isSameDay(d, today);
          return (
            <TapButton
              key={i}
              onClick={() => onPick(d)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 4px',
                borderRadius: R.sm,
                background: 'transparent',
                border: `1px solid ${!isSelected && isToday ? T.accentSoft : 'transparent'}`,
                fontFamily: 'inherit',
                transition: 'border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isSelected && (
                <motion.div
                  layoutId="cal-day-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: R.sm,
                    background: T.accent,
                    zIndex: 0,
                  }}
                />
              )}
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isSelected ? 'rgba(255,255,255,0.85)' : T.textTertiary,
                  lineHeight: 1,
                  transition: 'color 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)}
              </span>
              <motion.span
                key={d.getDate()}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: isSelected ? '#fff' : isToday ? T.accent : T.text,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {d.getDate()}
              </motion.span>
            </TapButton>
          );
        })}
      </div>
      {!isOnToday && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <TapButton
            onClick={onJumpToday}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.accent,
              background: 'transparent',
              border: 0,
              padding: '4px 12px',
              borderRadius: R.pill,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            ← {todayLabel}
          </TapButton>
        </div>
      )}
    </div>
  );
}

