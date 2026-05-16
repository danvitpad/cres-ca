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
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileMasterId, setMobileMasterId] = useState<string | null>(null);
  const [masterMenuOpen, setMasterMenuOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  if (isMobileView) {
    const ACCENT = '#2563eb';
    const MASTER_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#e11d48', '#0891b2', '#16a34a'];

    const masterColor = (idx: number) => MASTER_COLORS[idx % MASTER_COLORS.length];

    // Build 7-day strip around selected day
    const selectedDate = fromDateInput(day);
    const weekDays: { label: string; dateStr: string; isToday: boolean; isSelected: boolean }[] = [];
    const DAY_LABELS = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    const todayStr = toDateInput(new Date());
    // Start strip on Monday of current week
    const startOfStrip = new Date(selectedDate);
    const dow = startOfStrip.getDay();
    startOfStrip.setDate(startOfStrip.getDate() - ((dow + 6) % 7));
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfStrip);
      d.setDate(d.getDate() + i);
      const ds = toDateInput(d);
      weekDays.push({ label: DAY_LABELS[d.getDay()], dateStr: ds, isToday: ds === todayStr, isSelected: ds === day });
    }

    // Filter appointments by selected master
    const mobileAppts = data.appointments
      .filter((a) => !mobileMasterId || a.master_id === mobileMasterId)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const selectedMasterObj = data.masters.find((m) => m.id === mobileMasterId);

    return (
      <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Календар</div>
          {/* Master selector */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMasterMenuOpen((o) => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedMasterObj ? masterColor(data.masters.indexOf(selectedMasterObj)) : ACCENT }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
                {selectedMasterObj ? (selectedMasterObj.display_name || 'Майстер') : 'Всі майстри'}
              </span>
              <ChevronRight style={{ width: 12, height: 12, color: '#94a3b8', transform: 'rotate(90deg)' }} />
            </button>
            {masterMenuOpen && (
              <div
                style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 180 }}
              >
                <button
                  type="button"
                  onClick={() => { setMobileMasterId(null); setMasterMenuOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: !mobileMasterId ? '#f0f7ff' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: !mobileMasterId ? 600 : 400 }}>Всі майстри</span>
                </button>
                {data.masters.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMobileMasterId(m.id); setMasterMenuOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: mobileMasterId === m.id ? '#f0f7ff' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: masterColor(idx) }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: mobileMasterId === m.id ? 600 : 400 }}>{m.display_name || 'Майстер'}</div>
                      {m.specialization && <div style={{ fontSize: 11, color: '#64748b' }}>{m.specialization}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 7-day strip */}
        <div style={{ display: 'flex', gap: 4, padding: '0 12px 12px', overflowX: 'auto' }}>
          {weekDays.map((d) => (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => setDay(d.dateStr)}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                width: 44,
                padding: '6px 0',
                borderRadius: 12,
                border: 'none',
                background: d.isSelected ? ACCENT : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 500, color: d.isSelected ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase' }}>{d.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: d.isSelected ? '#fff' : d.isToday ? ACCENT : '#0f172a' }}>{parseInt(d.dateStr.slice(8))}</span>
              {d.isToday && !d.isSelected && <div style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT }} />}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 120px' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Завантаження…</div>
          ) : mobileAppts.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>Записів немає</div>
            </div>
          ) : (
            mobileAppts.map((a) => {
              const masterIdx = data.masters.findIndex((m) => m.id === a.master_id);
              const mColor = masterColor(masterIdx >= 0 ? masterIdx : 0);
              const master = data.masters[masterIdx];
              const startTime = new Date(a.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const endTime = new Date(a.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const initials = (master?.display_name || 'М').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
              const clientInitials = (a.client_name || 'К').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
              const isCancelled = a.status === 'cancelled';
              const isCompleted = a.status === 'completed' || a.status === 'paid';

              return (
                <div
                  key={a.id}
                  style={{ display: 'flex', gap: 10, marginBottom: 10 }}
                >
                  <div style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingTop: 14 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{startTime}</span>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: '#fff',
                      borderRadius: 12,
                      border: `1px solid ${isCancelled ? '#fecdd3' : isCompleted ? '#bbf7d0' : `${mColor}30`}`,
                      borderLeft: `3px solid ${isCancelled ? '#f43f5e' : isCompleted ? '#10b981' : mColor}`,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${mColor}20`, color: mColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {clientInitials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.client_name || 'Клієнт'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.service_name || 'Послуга не вказана'}
                        </div>
                        <div style={{ fontSize: 11, color: mColor, marginTop: 1 }}>
                          {master?.display_name || 'Майстер'} · {startTime}–{endTime}
                        </div>
                      </div>
                      {!mobileMasterId && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: mColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {initials}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {startTime}–{endTime}
                        {a.created_by_role && a.created_by_role !== 'master' && ` · ${roleLabel(a.created_by_role)}`}
                      </span>
                      {a.price != null && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>₴ {a.price.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FAB */}
        {data.masters.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedMasterId(mobileMasterId ?? data.masters[0].id);
              setDefaultTime(undefined);
              setOpenNew(true);
            }}
            style={{ position: 'fixed', bottom: 24, right: 20, width: 52, height: 52, borderRadius: '50%', background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,99,235,0.4)', zIndex: 40 }}
          >
            <Plus style={{ width: 22, height: 22 }} />
          </button>
        )}

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

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3 justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-300">
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
