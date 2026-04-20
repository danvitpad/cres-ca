/** --- YAML
 * name: Mini App Salon Calendar
 * description: Admin/receptionist salon calendar inside the Mini App. List view of appointments
 *              for the selected day, with master filter dropdown (Все / конкретный).
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Building2, Users } from 'lucide-react';
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
  } catch {
    /* ignore */
  }
  return null;
}

interface Master {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
}

interface Appointment {
  id: string;
  master_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  service_name: string | null;
  created_by_role: string | null;
}

interface CalendarData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  role: 'admin' | 'receptionist';
  masters: Master[];
  appointments: Appointment[];
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fromDateInput(s: string) {
  return new Date(`${s}T00:00:00`);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function roleChip(role: string | null): string | null {
  switch (role) {
    case 'admin': return 'админ';
    case 'receptionist': return 'ресепшн';
    case 'client': return 'клиент';
    case 'voice_ai': return 'Voice AI';
    default: return null;
  }
}

export default function MiniAppSalonCalendar() {
  const params = useParams();
  const salonId = params.id as string;
  const { ready } = useTelegram();

  const [day, setDay] = useState<string>(toDateInput(new Date()));
  const [masterFilter, setMasterFilter] = useState<string>('all');
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const from = fromDateInput(day).toISOString();
    const to = new Date(fromDateInput(day).getTime() + 86400000).toISOString();
    fetch(`/api/telegram/m/salon/${salonId}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, from, to }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j: CalendarData) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, salonId, day]);

  const shiftDay = (delta: number) => {
    const base = fromDateInput(day);
    base.setDate(base.getDate() + delta);
    setDay(toDateInput(base));
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (masterFilter === 'all') return data.appointments;
    return data.appointments.filter((a) => a.master_id === masterFilter);
  }, [data, masterFilter]);

  const masterMap = useMemo(() => {
    const m = new Map<string, Master>();
    data?.masters.forEach((x) => m.set(x.id, x));
    return m;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error === '403' || error === 'forbidden') {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Доступ только для владельца или ресепшн
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Не удалось загрузить</div>;
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="size-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-300">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Общий календарь</div>
          <h1 className="text-lg font-bold truncate">{data.salon.name}</h1>
        </div>
      </motion.div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          aria-label="Prev"
          className="size-9 rounded-lg border border-border flex items-center justify-center"
        >
          <ChevronLeft className="size-4" />
        </button>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="flex-1 h-9 px-2 border border-border rounded-lg bg-background text-sm"
        />
        <button
          type="button"
          onClick={() => shiftDay(1)}
          aria-label="Next"
          className="size-9 rounded-lg border border-border flex items-center justify-center"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div>
        <label className="text-[10px] uppercase text-muted-foreground tracking-wider">Мастер</label>
        <select
          value={masterFilter}
          onChange={(e) => setMasterFilter(e.target.value)}
          className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="all">Все мастера</option>
          {data.masters.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name || 'Мастер'}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          <Users className="size-8 mx-auto mb-2 text-muted-foreground/60" />
          На эту дату записей нет
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const master = masterMap.get(a.master_id);
            const chip = roleChip(a.created_by_role);
            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-3 flex gap-3"
              >
                <div className="flex flex-col items-center shrink-0 text-center min-w-[52px]">
                  <div className="text-sm font-bold">{formatTime(a.starts_at)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatTime(a.ends_at)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.client_name ?? 'Клиент'}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.service_name ?? '—'}</div>
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {master && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[120px]">
                        {master.display_name || 'Мастер'}
                      </span>
                    )}
                    {chip && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {chip}
                      </span>
                    )}
                    {(a.status === 'cancelled') && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">отменено</span>
                    )}
                    {(a.status === 'completed' || a.status === 'paid') && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">завершено</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
