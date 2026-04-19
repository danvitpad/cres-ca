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

const STATUS_META: Record<Status, { label: string; strip: string; text: string }> = {
  booked: { label: 'Забронировано', strip: 'bg-blue-500', text: 'text-blue-300' },
  confirmed: { label: 'Подтверждено', strip: 'bg-violet-500', text: 'text-violet-300' },
  in_progress: { label: 'Идёт', strip: 'bg-amber-500', text: 'text-amber-300' },
  completed: { label: 'Выполнено', strip: 'bg-emerald-500', text: 'text-emerald-300' },
  cancelled: { label: 'Отменено', strip: 'bg-white/20', text: 'text-white/40' },
  cancelled_by_client: { label: 'Отменил клиент', strip: 'bg-white/20', text: 'text-white/40' },
  no_show: { label: 'Не пришёл', strip: 'bg-rose-500', text: 'text-rose-300' },
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 pt-6 pb-10">
      {/* Day header — no page title, just the day + count + FAB */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">{formatDayHeader(day)}</h1>
          <p className="mt-0.5 text-[11px] text-white/40">
            {totals.count} {plural(totals.count, ['запись', 'записи', 'записей'])} · {totals.revenue.toFixed(0)} ₴
          </p>
        </div>
        <Link
          href="/telegram/m/slot/new"
          onClick={() => haptic('selection')}
          className="flex size-11 items-center justify-center rounded-2xl bg-white text-black active:bg-white/90 transition-colors"
        >
          <Plus className="size-5" />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            haptic('light');
            setDay(addDays(day, -1));
          }}
          className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={() => {
            haptic('selection');
            setDay(startOfDay(new Date()));
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-semibold active:bg-white/[0.06] transition-colors"
        >
          <CalendarDays className="size-3.5" />
          {day.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
        </button>
        <button
          onClick={() => {
            haptic('light');
            setDay(addDays(day, 1));
          }}
          className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Appointments list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white/[0.06]">
            <CalendarDays className="size-5 text-white/60" />
          </div>
          <p className="mt-3 text-base font-semibold">Записей нет</p>
          <p className="mt-1 text-xs text-white/50">Добавь запись вручную или жди онлайн-бронирования</p>
        </div>
      ) : (
        <ul className="space-y-2">
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
                  onClick={() => onSelect(r.id)}
                  className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 pl-5 text-left active:bg-white/[0.06] transition-colors"
                >
                  <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${meta.strip}`} />
                  <div className="flex w-14 shrink-0 flex-col items-center text-center">
                    <span className="text-[15px] font-bold tabular-nums">
                      {new Date(r.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {r.duration_min} мин
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.service_name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-white/60">{r.client_name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.text}`}>
                        {meta.label}
                      </span>
                      <span className="text-[11px] font-semibold text-white/80">{r.price.toFixed(0)} ₴</span>
                    </div>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[32px] border-t border-white/10 bg-[#2f3437] px-5 pt-4 pb-8"
              style={{ paddingBottom: 'calc(2rem + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))' }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

              <div className="space-y-4">
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border border-white/10 ${STATUS_META[active.status].text}`}>
                    <span className={`inline-block size-1.5 rounded-full ${STATUS_META[active.status].strip}`} />
                    {STATUS_META[active.status].label}
                  </span>
                  <h2 className="mt-2 text-xl font-bold">{active.service_name}</h2>
                  <div className="mt-2 flex items-center gap-3 text-[13px] text-white/70">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {new Date(active.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(active.ends_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <span className="text-white/30">·</span>
                    <span className="font-semibold">{active.price.toFixed(0)} ₴</span>
                  </div>
                </div>

                {/* Client */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">Клиент</p>
                  <p className="mt-1 text-sm font-semibold">{active.client_name}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {active.client_phone && (
                      <a
                        href={`tel:${active.client_phone}`}
                        onClick={() => haptic('selection')}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-[12px] font-semibold active:bg-white/[0.08] transition-colors"
                      >
                        <Phone className="size-3.5" /> {active.client_phone}
                      </a>
                    )}
                    {active.client_id && (
                      <Link
                        href={`/telegram/m/clients/${active.client_id}`}
                        onClick={() => haptic('light')}
                        className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] active:bg-white/[0.08] transition-colors"
                      >
                        <UserIcon className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>

                {active.notes && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Заметки</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/80">{active.notes}</p>
                  </div>
                )}

                {active.status === 'in_progress' && (
                  <ServiceTimer startsAt={active.starts_at} endsAt={active.ends_at} />
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {(active.status === 'booked' || active.status === 'confirmed') && (
                    <button
                      disabled={acting}
                      onClick={() => updateStatus(active.id, 'in_progress')}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-[15px] font-semibold text-black active:bg-amber-400 transition-colors disabled:opacity-50"
                    >
                      <PlayCircle className="size-4" /> Начать визит
                    </button>
                  )}
                  {(active.status === 'booked' || active.status === 'confirmed' || active.status === 'in_progress') && (
                    <button
                      disabled={acting}
                      onClick={() => updateStatus(active.id, 'completed')}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-semibold text-black active:bg-emerald-400 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" /> Завершить
                    </button>
                  )}
                  {(active.status === 'booked' || active.status === 'confirmed') && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={acting}
                        onClick={() =>
                          updateStatus(active.id, 'cancelled', {
                            cancelled_at: new Date().toISOString(),
                            cancelled_by: userId,
                            cancellation_reason: 'master_miniapp',
                          })
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[12px] font-semibold active:bg-white/[0.06] transition-colors disabled:opacity-50"
                      >
                        <XCircle className="size-3.5" /> Отменить
                      </button>
                      <button
                        disabled={acting}
                        onClick={() => updateStatus(active.id, 'no_show')}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-white/[0.03] py-3 text-[12px] font-semibold text-rose-300 active:bg-rose-500/10 transition-colors disabled:opacity-50"
                      >
                        <UserX className="size-3.5" /> Не пришёл
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
    <div className={`rounded-2xl border p-4 ${overdue ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
        <span className={overdue ? 'text-red-300' : 'text-amber-200'}>
          {overdue ? 'Превышено' : 'Идёт визит'}
        </span>
        <span className="tabular-nums text-white/70">
          {fmt(elapsed)} / {fmt(total)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full transition-all ${overdue ? 'bg-red-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-center text-[12px] font-semibold tabular-nums">
        {overdue ? `+${fmt(-remaining)}` : fmt(remaining)}
      </div>
    </div>
  );
}
