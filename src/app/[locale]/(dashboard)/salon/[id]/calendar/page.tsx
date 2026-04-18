/** --- YAML
 * name: Salon Team Calendar
 * description: Admin + receptionist view. Column-per-master day schedule. Day navigation, quick
 *              create (with master dropdown), records carry created_by_role label.
 * created: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Building2, Users } from 'lucide-react';
import { NewAppointmentDialog } from '@/components/calendar/new-appointment-dialog';

interface Master {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
}

interface Appointment {
  id: string;
  master_id: string;
  client_id: string | null;
  service_id: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  price: number | null;
  currency: string | null;
  notes: string | null;
  created_by_role: string | null;
  client_name: string | null;
  service_name: string | null;
}

interface CalendarData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  role: 'admin' | 'receptionist';
  masters: Master[];
  appointments: Appointment[];
  range: { from: string; to: string };
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 .. 20:00
const ROW_HEIGHT = 40; // px per hour
const SLOT_MIN_HEIGHT = 24;

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fromDateInput(s: string) {
  return new Date(`${s}T00:00:00`);
}

function roleLabel(role: string | null): string {
  switch (role) {
    case 'admin': return 'админ';
    case 'receptionist': return 'ресепшн';
    case 'master': return 'мастер';
    case 'client': return 'клиент';
    case 'voice_ai': return 'Voice AI';
    default: return '';
  }
}

export default function SalonTeamCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const salonId = params.id as string;
  const locale = params.locale as string;

  const [day, setDay] = useState<string>(toDateInput(new Date()));
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    setLoading(true);
    const from = fromDateInput(day).toISOString();
    const to = new Date(fromDateInput(day).getTime() + 86400000).toISOString();
    fetch(`/api/salon/${salonId}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (r) => {
        if (r.status === 403) throw new Error('forbidden');
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then((j: CalendarData) => setData(j))
      .catch((e) => setError(e instanceof Error ? e.message : 'error'))
      .finally(() => setLoading(false));
  }, [salonId, day]);

  useEffect(() => { load(); }, [load]);

  const shiftDay = (delta: number) => {
    const base = fromDateInput(day);
    base.setDate(base.getDate() + delta);
    setDay(toDateInput(base));
  };

  const byMaster = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    if (!data) return map;
    for (const a of data.appointments) {
      if (!map.has(a.master_id)) map.set(a.master_id, []);
      map.get(a.master_id)!.push(a);
    }
    return map;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h2 className="text-lg font-semibold">Доступ только для администратора или ресепшн</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Общий календарь салона доступен владельцу и ресепшн.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">Не удалось загрузить календарь</div>
    );
  }

  const dayStart = fromDateInput(day);
  const dayStartMs = dayStart.getTime();
  const isUnified = data.salon.team_mode === 'unified';

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3 justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              {isUnified ? 'Единый бизнес' : 'Коворкинг'} · общий календарь
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{data.salon.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Предыдущий день"
            onClick={() => shiftDay(-1)}
            className="size-9 rounded-lg border border-border hover:bg-muted flex items-center justify-center"
          >
            <ChevronLeft className="size-4" />
          </button>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-9 px-2 border border-border rounded-lg bg-background text-sm"
          />
          <button
            type="button"
            aria-label="Следующий день"
            onClick={() => shiftDay(1)}
            className="size-9 rounded-lg border border-border hover:bg-muted flex items-center justify-center"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setDay(toDateInput(new Date()))}
            className="ml-1 h-9 px-3 text-sm border border-border rounded-lg hover:bg-muted"
          >
            Сегодня
          </button>
        </div>
      </motion.div>

      {data.masters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Users className="size-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-base font-semibold">В команде пока нет мастеров</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Пригласите первого мастера — он появится здесь колонкой.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/settings/team`)}
            className="mt-4 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Управлять командой
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `64px repeat(${data.masters.length}, minmax(180px, 1fr))`,
              }}
            >
              <div className="bg-muted/40 border-b border-border" />
              {data.masters.map((m) => (
                <div
                  key={m.id}
                  className="bg-muted/40 border-b border-l border-border p-2 flex items-center gap-2"
                >
                  <div className="size-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="size-full object-cover" />
                      : (m.display_name || 'M')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.display_name || 'Мастер'}</div>
                    {m.specialization && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {m.specialization}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {HOURS.map((h) => (
                <Row
                  key={h}
                  hour={h}
                  masters={data.masters}
                  byMaster={byMaster}
                  dayStartMs={dayStartMs}
                  onSlotClick={(mId, time) => {
                    setSelectedMasterId(mId);
                    setDefaultTime(time);
                    setOpenNew(true);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-5">
        {data.masters.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedMasterId(data.masters[0].id);
              setDefaultTime(undefined);
              setOpenNew(true);
            }}
            className="h-12 pl-4 pr-5 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 text-sm font-semibold"
          >
            <Plus className="size-4" /> Новая запись
          </button>
        )}
      </div>

      {selectedMasterId && (
        <TeamNewAppointment
          open={openNew}
          onOpenChange={setOpenNew}
          salonId={salonId}
          masters={data.masters}
          initialMasterId={selectedMasterId}
          defaultDate={day}
          defaultTime={defaultTime}
          createdByRole={data.role}
          onCreated={() => load()}
        />
      )}
    </div>
  );
}

function Row({
  hour, masters, byMaster, dayStartMs, onSlotClick,
}: {
  hour: number;
  masters: Master[];
  byMaster: Map<string, Appointment[]>;
  dayStartMs: number;
  onSlotClick: (masterId: string, time: string) => void;
}) {
  const label = `${String(hour).padStart(2, '0')}:00`;
  return (
    <>
      <div
        className="border-t border-border text-[10px] text-muted-foreground px-2 py-1"
        style={{ height: ROW_HEIGHT }}
      >
        {label}
      </div>
      {masters.map((m) => {
        const appts = byMaster.get(m.id) ?? [];
        const inHour = appts.filter((a) => {
          const start = new Date(a.starts_at);
          return start.getHours() === hour;
        });
        return (
          <div
            key={m.id}
            className="border-t border-l border-border relative cursor-pointer hover:bg-muted/30"
            style={{ height: ROW_HEIGHT }}
            onClick={() => onSlotClick(m.id, `${String(hour).padStart(2, '0')}:00`)}
          >
            {inHour.map((a) => {
              const start = new Date(a.starts_at).getTime();
              const end = new Date(a.ends_at).getTime();
              const startOffsetMin = (start - dayStartMs) / 60000 - hour * 60;
              const durationMin = Math.max(15, (end - start) / 60000);
              const top = (startOffsetMin / 60) * ROW_HEIGHT;
              const height = Math.max(SLOT_MIN_HEIGHT, (durationMin / 60) * ROW_HEIGHT - 2);
              return (
                <div
                  key={a.id}
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute left-1 right-1 rounded-md px-1.5 py-0.5 text-[10px] overflow-hidden border ${
                    a.status === 'cancelled'
                      ? 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      : a.status === 'completed' || a.status === 'paid'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-primary/10 border-primary/40 text-primary'
                  }`}
                  style={{ top, height }}
                  title={`${a.service_name ?? ''} · ${a.client_name ?? 'Клиент'}${a.created_by_role ? ` · ${roleLabel(a.created_by_role)}` : ''}`}
                >
                  <div className="font-medium truncate">
                    {a.client_name ?? 'Клиент'}
                  </div>
                  <div className="truncate opacity-80">{a.service_name ?? ''}</div>
                  {a.created_by_role && a.created_by_role !== 'master' && (
                    <div className="opacity-60 text-[9px] truncate">{roleLabel(a.created_by_role)}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function TeamNewAppointment({
  open, onOpenChange, masters, initialMasterId, defaultDate, defaultTime, createdByRole, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  salonId: string;
  masters: Master[];
  initialMasterId: string;
  defaultDate: string;
  defaultTime: string | undefined;
  createdByRole: 'admin' | 'receptionist';
  onCreated: () => void;
}) {
  const [masterId, setMasterId] = useState(initialMasterId);
  useEffect(() => { if (open) setMasterId(initialMasterId); }, [open, initialMasterId]);

  return (
    <>
      <div className={open ? 'fixed inset-x-0 top-0 z-[60] bg-background border-b border-border' : 'hidden'}>
        <div className="max-w-xl mx-auto p-3 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Мастер:</label>
          <select
            value={masterId}
            onChange={(e) => setMasterId(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {masters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || 'Мастер'}
              </option>
            ))}
          </select>
        </div>
      </div>
      <NewAppointmentDialog
        open={open}
        onOpenChange={onOpenChange}
        masterId={masterId}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        createdByRole={createdByRole}
        onCreated={onCreated}
      />
    </>
  );
}
