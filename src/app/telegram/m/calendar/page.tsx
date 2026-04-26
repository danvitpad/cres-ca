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
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

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

type Status = 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'cancelled_by_client';

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

function formatDayHeader(d: Date) {
  const today = new Date();
  if (isSameDay(d, today)) return 'Сегодня';
  if (isSameDay(d, addDays(today, 1))) return 'Завтра';
  if (isSameDay(d, addDays(today, -1))) return 'Вчера';
  return d.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });
}

const STATUS_META: Record<Status, { label: string; stripBg: string; chipBg: string; chipColor: string }> = {
  booked: { label: 'Забронировано', stripBg: '#3b82f6', chipBg: '#dbeafe', chipColor: '#1d4ed8' },
  confirmed: { label: 'Подтверждено', stripBg: '#6c5ce7', chipBg: T.accentSoft, chipColor: T.accent },
  in_progress: { label: 'Идёт', stripBg: '#f59e0b', chipBg: '#fef3c7', chipColor: '#b45309' },
  completed: { label: 'Выполнено', stripBg: '#10b981', chipBg: T.successSoft, chipColor: T.success },
  cancelled: { label: 'Отменено', stripBg: T.border, chipBg: T.bgSubtle, chipColor: T.textTertiary },
  cancelled_by_client: { label: 'Отменил клиент', stripBg: T.border, chipBg: T.bgSubtle, chipColor: T.textTertiary },
  no_show: { label: 'Не пришёл', stripBg: T.danger, chipBg: T.dangerSoft, chipColor: T.danger },
};

export default function MasterMiniAppCalendar() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const focusId = searchParams.get('id');

  // Master ID resolved together with day data via /api/telegram/m/calendar
  // (no separate fetch needed)

  const loadDay = useCallback(async () => {
    setLoading(true);
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
        client_name: cp?.full_name ?? 'Клиент',
        client_phone: cp?.phone ?? null,
        service_name: svc?.name ?? '—',
        duration_min: Number(svc?.duration_minutes ?? 0),
      };
    });
    setRows(mapped);
    setLoading(false);
  }, [day, focusId]);

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
        <PageHeader
          title={formatDayHeader(day)}
          subtitle={`${totals.count} ${plural(totals.count, ['запись', 'записи', 'записей'])} · ${totals.revenue.toFixed(0)} ₴`}
          right={
            <Link
              href="/telegram/m/slot/new"
              onClick={() => haptic('selection')}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: T.text,
                color: T.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
              aria-label="Новая запись"
            >
              <Plus size={20} strokeWidth={2.4} />
            </Link>
          }
        />

        {/* Day nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          <button
            type="button"
            onClick={() => { haptic('light'); setDay(addDays(day, -1)); }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={18} color={T.text} />
          </button>
          <button
            type="button"
            onClick={() => { haptic('selection'); setDay(startOfDay(new Date())); }}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 14px',
              borderRadius: R.pill,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <CalendarDays size={14} />
            {day.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
          </button>
          <button
            type="button"
            onClick={() => { haptic('light'); setDay(addDays(day, 1)); }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1px solid ${T.border}`,
              background: T.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronRight size={18} color={T.text} />
          </button>
        </div>

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
              <p style={{ ...TYPE.bodyStrong, color: T.text, marginTop: 14 }}>Записей нет</p>
              <p style={{ ...TYPE.caption, marginTop: 4 }}>
                Добавь запись вручную или жди онлайн-бронирования
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r, i) => {
                const meta = STATUS_META[r.status];
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <button
                      type="button"
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
                        cursor: 'pointer',
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
                          width: 56,
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(r.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: 10, color: T.textTertiary, marginTop: 2 }}>
                          {r.duration_min} мин
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
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: meta.chipBg,
                              color: meta.chipColor,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.05em',
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
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

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
                        background: STATUS_META[active.status].chipBg,
                        color: STATUS_META[active.status].chipColor,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_META[active.status].stripBg }} />
                      {STATUS_META[active.status].label}
                    </span>
                    <h2 style={{ ...TYPE.h2, color: T.text, marginTop: 8, marginBottom: 0 }}>{active.service_name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, ...TYPE.body, color: T.textSecondary }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} />
                        {new Date(active.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(active.ends_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span style={{ color: T.textTertiary }}>·</span>
                      <span style={{ fontWeight: 700, color: T.text }}>{active.price.toFixed(0)} ₴</span>
                    </div>
                  </div>

                  {/* Client */}
                  <div style={{ background: T.surfaceElevated, border: `1px solid ${T.borderSubtle}`, borderRadius: R.md, padding: 14 }}>
                    <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase' }}>Клиент</p>
                    <p style={{ ...TYPE.bodyStrong, color: T.text, marginTop: 4 }}>{active.client_name}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {active.client_phone && (
                        <a
                          href={`tel:${active.client_phone}`}
                          onClick={() => haptic('selection')}
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
                      <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase' }}>Заметки</p>
                      <p style={{ ...TYPE.body, color: T.text, marginTop: 4, whiteSpace: 'pre-wrap' }}>{active.notes}</p>
                    </div>
                  )}

                  {active.status === 'in_progress' && (
                    <ServiceTimer startsAt={active.starts_at} endsAt={active.ends_at} />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(active.status === 'booked' || active.status === 'confirmed') && (
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => updateStatus(active.id, 'in_progress')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '14px',
                          borderRadius: R.md,
                          background: '#f59e0b',
                          color: '#000',
                          border: 'none',
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          opacity: acting ? 0.5 : 1,
                        }}
                      >
                        <PlayCircle size={16} /> Начать визит
                      </button>
                    )}
                    {(active.status === 'booked' || active.status === 'confirmed' || active.status === 'in_progress') && (
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => updateStatus(active.id, 'completed')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '14px',
                          borderRadius: R.md,
                          background: T.success,
                          color: '#fff',
                          border: 'none',
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          opacity: acting ? 0.5 : 1,
                        }}
                      >
                        <CheckCircle2 size={16} /> Завершить
                      </button>
                    )}
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
                          <XCircle size={14} /> Отменить
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
                          <UserX size={14} /> Не пришёл
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
    </MobilePage>
  );
}

function ServiceTimer({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
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
          {overdue ? 'Превышено' : 'Идёт визит'}
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
