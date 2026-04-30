/** --- YAML
 * name: BookingDrawer
 * description: Полноэкранный drawer бронирования на публичной странице мастера.
 *              3 шага по референсу Fresha:
 *                1. Услуги — выбор одной услуги (multi-cart позже)
 *                2. Время — день + слот (через /api/slots)
 *                3. Подтверждение — summary + создание записи
 *              Без редиректов: drawer overlays /m/[handle], после успеха
 *              показывает экран «Запись создана».
 *              На mobile — full-screen sheet (slide-up). На desktop — drawer
 *              full-height (slide-from-right).
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, Clock, Check, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/format/money';
import { composeAddress } from '@/lib/format/address';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';
import type { BookingMaster, BookingService } from './booking-context';

interface Props {
  master: BookingMaster;
  services: BookingService[];
  open: boolean;
  onClose: () => void;
  defaultServiceId?: string | null;
}

type Step = 'services' | 'time' | 'confirm' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'services', label: 'Услуги' },
  { key: 'time', label: 'Время' },
  { key: 'confirm', label: 'Подтверждение' },
];

function formatDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

function dateLabel(d: Date): string {
  const months = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const DAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function BookingDrawer({ master, services, open, onClose, defaultServiceId }: Props) {
  const [step, setStep] = useState<Step>('services');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(defaultServiceId ?? null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdAptId, setCreatedAptId] = useState<string | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('services');
      setSelectedServiceId(defaultServiceId ?? null);
      setSelectedDate(startOfDay(new Date()));
      setSelectedTime(null);
      setSlots(null);
      setNotes('');
      setCreatedAptId(null);
    }
  }, [open, defaultServiceId]);

  // Auto-jump to "time" if defaultServiceId is set on first open
  useEffect(() => {
    if (open && defaultServiceId) {
      setStep('time');
    }
  }, [open, defaultServiceId]);

  // Body scroll lock when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape closes drawer
  useEscapeKey(open, onClose);

  // Fetch slots when entering time step / changing service or date
  useEffect(() => {
    if (step !== 'time' || !selectedServiceId) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlots(null);
    const params = new URLSearchParams({
      master_id: master.id,
      date: toISODate(selectedDate),
      service_id: selectedServiceId,
    });
    fetch(`/api/slots?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d: { slots?: string[] }) => {
        if (cancelled) return;
        setSlots(d.slots ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => { cancelled = true; };
  }, [step, selectedServiceId, selectedDate, master.id]);

  // 7-day strip starting today
  const weekStrip = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }).map((_, i) => addDays(today, i));
  }, []);

  async function submit() {
    if (!selectedService || !selectedTime) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to /book route which has its own auth-handling for guests
        const params = new URLSearchParams({
          master: master.id,
          service: selectedService.id,
          date: toISODate(selectedDate),
          time: selectedTime,
        });
        if (notes.trim()) params.set('notes', notes.trim());
        window.location.href = `/ru/book?${params.toString()}`;
        return;
      }

      // Find or create the client row
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('master_id', master.id)
        .eq('profile_id', user.id)
        .maybeSingle();

      let clientId = (existing as { id: string } | null)?.id ?? null;
      if (!clientId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, email')
          .eq('id', user.id)
          .maybeSingle();
        const fullName = (profile as { full_name?: string | null } | null)?.full_name || 'Клиент';
        const phone = (profile as { phone?: string | null } | null)?.phone ?? null;
        const email = (profile as { email?: string | null } | null)?.email ?? null;
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            master_id: master.id,
            profile_id: user.id,
            full_name: fullName,
            phone,
            email,
          })
          .select('id')
          .single();
        if (clientErr) {
          toast.error(clientErr.message || 'Не удалось создать клиента');
          return;
        }
        clientId = (newClient as { id: string }).id;
      }

      const [hh, mm] = selectedTime.split(':').map(Number);
      const startsAt = new Date(selectedDate);
      startsAt.setHours(hh, mm, 0, 0);
      const duration = selectedService.duration_minutes ?? 60;
      const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

      const { data: created, error } = await supabase
        .from('appointments')
        .insert({
          master_id: master.id,
          client_id: clientId,
          service_id: selectedService.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          price: selectedService.price ?? 0,
          currency: (selectedService.currency || 'UAH').toUpperCase(),
          notes: notes.trim() || null,
          status: 'booked',
          booked_via: 'public_page',
        })
        .select('id')
        .single();

      if (error) {
        toast.error(error.message || 'Не удалось создать запись');
        return;
      }
      const aptId = (created as { id: string }).id;
      setCreatedAptId(aptId);
      // Notify master + confirm to client (best-effort)
      fetch(`/api/appointments/${aptId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'client' }),
      }).catch(() => undefined);
      setStep('done');
      toast.success('Запись создана');
    } catch (e) {
      toast.error((e as Error).message || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const canGoBack = step !== 'services' && step !== 'done';
  const showBreadcrumb = step !== 'done';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label="Бронирование"
            className="fixed inset-x-0 bottom-0 top-4 z-[101] flex flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:top-4 sm:bottom-4 sm:w-[min(960px,calc(100vw-32px))] sm:rounded-[24px]"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                {canGoBack ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 'time') setStep('services');
                      else if (step === 'confirm') setStep('time');
                    }}
                    className="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    aria-label="Назад"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                ) : (
                  <div className="size-9" />
                )}
                {showBreadcrumb && (
                  <nav className="hidden gap-2 text-[14px] sm:flex">
                    {STEPS.map((s, i) => (
                      <span
                        key={s.key}
                        className={
                          i === stepIndex
                            ? 'font-bold text-neutral-900'
                            : i < stepIndex
                            ? 'text-neutral-700'
                            : 'text-neutral-400'
                        }
                      >
                        {s.label}
                        {i < STEPS.length - 1 && <span className="ml-2 text-neutral-300">›</span>}
                      </span>
                    ))}
                  </nav>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mobile breadcrumb under top bar */}
            {showBreadcrumb && (
              <div className="flex gap-2 border-b border-neutral-100 px-4 pb-2 pt-1 text-[12px] sm:hidden">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={
                      i === stepIndex
                        ? 'font-bold text-neutral-900'
                        : i < stepIndex
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                    }
                  >
                    {s.label}
                    {i < STEPS.length - 1 && <span className="ml-1 text-neutral-300">›</span>}
                  </span>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
              {/* Step content */}
              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
                {step === 'services' && (
                  <ServicesStep
                    master={master}
                    services={services}
                    selectedId={selectedServiceId}
                    onSelect={(id) => setSelectedServiceId(id)}
                  />
                )}
                {step === 'time' && selectedService && (
                  <TimeStep
                    weekStrip={weekStrip}
                    selectedDate={selectedDate}
                    onDateChange={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                    slots={slots}
                    slotsLoading={slotsLoading}
                    selectedTime={selectedTime}
                    onTimeSelect={setSelectedTime}
                  />
                )}
                {step === 'confirm' && selectedService && selectedTime && (
                  <ConfirmStep
                    master={master}
                    service={selectedService}
                    date={selectedDate}
                    time={selectedTime}
                    notes={notes}
                    onNotesChange={setNotes}
                  />
                )}
                {step === 'done' && createdAptId && selectedService && selectedTime && (
                  <DoneStep
                    master={master}
                    service={selectedService}
                    date={selectedDate}
                    time={selectedTime}
                    onClose={onClose}
                  />
                )}
              </div>

              {/* Sticky cart panel — desktop only, hidden on done */}
              {step !== 'done' && (
                <aside className="hidden w-[320px] shrink-0 border-l border-neutral-100 p-6 sm:flex sm:flex-col">
                  <CartPanel
                    master={master}
                    service={selectedService}
                    date={step === 'services' ? null : selectedDate}
                    time={step !== 'confirm' ? null : selectedTime}
                    canContinue={
                      step === 'services'
                        ? !!selectedService
                        : step === 'time'
                        ? !!selectedTime
                        : true
                    }
                    onContinue={() => {
                      if (step === 'services') setStep('time');
                      else if (step === 'time') setStep('confirm');
                      else if (step === 'confirm') submit();
                    }}
                    submitting={submitting}
                    isFinal={step === 'confirm'}
                  />
                </aside>
              )}
            </div>

            {/* Mobile bottom CTA — sticky, hidden on done */}
            {step !== 'done' && (
              <div className="border-t border-neutral-100 bg-white p-3 sm:hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'services') setStep('time');
                    else if (step === 'time') setStep('confirm');
                    else if (step === 'confirm') submit();
                  }}
                  disabled={
                    submitting ||
                    (step === 'services' && !selectedService) ||
                    (step === 'time' && !selectedTime)
                  }
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--brand-radius-lg)] bg-neutral-900 text-[15px] font-semibold text-white disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Сохранение…
                    </>
                  ) : step === 'confirm' ? (
                    'Подтвердить запись'
                  ) : (
                    'Продолжить'
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ───────────── STEP COMPONENTS ───────────── */

function ServicesStep({
  master,
  services,
  selectedId,
  onSelect,
}: {
  master: BookingMaster;
  services: BookingService[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [activeCat, setActiveCat] = useState<string>('all');

  const groups = useMemo(() => {
    const map = new Map<string, BookingService[]>();
    for (const s of services) {
      const cat = s.category?.name?.trim() || 'Услуги';
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    }
    return Array.from(map.entries());
  }, [services]);

  const showPills = groups.length > 1;
  const filtered = activeCat === 'all' ? services : services.filter((s) => (s.category?.name?.trim() || 'Услуги') === activeCat);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight text-neutral-900 sm:text-[32px]">Услуги</h1>

      {/* Master mini-hero */}
      <div className="flex items-center gap-3">
        {master.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={master.avatarUrl} alt="" className="size-12 rounded-full object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-[16px] font-bold text-neutral-700">
            {master.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-[15px] font-semibold text-neutral-900">{master.displayName}</p>
          {master.specialization && (
            <p className="text-[13px] text-neutral-500">{master.specialization}</p>
          )}
        </div>
      </div>

      {showPills && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setActiveCat('all')}
            className={
              'whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ' +
              (activeCat === 'all'
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')
            }
          >
            Все
          </button>
          {groups.map(([name]) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveCat(name)}
              className={
                'whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ' +
                (activeCat === name
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')
              }
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((s) => {
          const isSelected = selectedId === s.id;
          const duration = formatDuration(s.duration_minutes);
          const priceStr = typeof s.price === 'number' && s.price > 0
            ? formatMoney(s.price, (s.currency || 'UAH').toUpperCase())
            : null;
          const name = s.name?.trim() || 'Услуга';
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={
                  'block w-full rounded-2xl border bg-white p-5 text-left transition-all ' +
                  (isSelected
                    ? 'border-neutral-900 ring-2 ring-neutral-900/20'
                    : 'border-neutral-200 hover:border-neutral-300')
                }
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[15px] font-semibold leading-snug text-neutral-900">{name}</p>
                    <p className="text-[13px] text-neutral-500">
                      {duration && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" /> {duration}
                        </span>
                      )}
                      {s.description && duration && ' · '}
                      {s.description && <span>{s.description}</span>}
                    </p>
                    {priceStr && (
                      <p className="pt-1 text-[15px] font-bold text-neutral-900">{priceStr}</p>
                    )}
                  </div>
                  <div
                    className={
                      'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ' +
                      (isSelected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-400')
                    }
                  >
                    {isSelected ? <Check className="size-4" /> : <span className="text-[16px] leading-none">+</span>}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TimeStep({
  weekStrip,
  selectedDate,
  onDateChange,
  slots,
  slotsLoading,
  selectedTime,
  onTimeSelect,
}: {
  weekStrip: Date[];
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  slots: string[] | null;
  slotsLoading: boolean;
  selectedTime: string | null;
  onTimeSelect: (t: string) => void;
}) {
  const monthLabel = selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight text-neutral-900 sm:text-[32px]">Выберите время</h1>

      <div>
        <p className="text-[14px] font-semibold capitalize text-neutral-700">{monthLabel}</p>
        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {weekStrip.map((d) => {
            const isActive = toISODate(d) === toISODate(selectedDate);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => onDateChange(d)}
                className={
                  'flex size-14 shrink-0 flex-col items-center justify-center rounded-full transition-colors ' +
                  (isActive
                    ? 'bg-violet-600 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')
                }
              >
                <span className="text-[16px] font-bold leading-none tabular-nums">{d.getDate()}</span>
                <span className={'mt-1 text-[10px] ' + (isActive ? 'text-white/90' : 'text-neutral-500')}>
                  {DAY_LABELS[d.getDay()]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {slotsLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <p className="text-[15px] font-semibold text-neutral-900">Нет свободных слотов</p>
            <p className="mt-1 text-[13px] text-neutral-500">Выбери другой день — свободное время появится.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {slots.map((t) => {
              const isSelected = selectedTime === t;
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => onTimeSelect(t)}
                    className={
                      'block w-full rounded-2xl border px-5 py-4 text-left transition-all ' +
                      (isSelected
                        ? 'border-violet-600 bg-violet-50 ring-2 ring-violet-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300')
                    }
                  >
                    <span className="text-[15px] font-semibold tabular-nums text-neutral-900">{t}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConfirmStep({
  master,
  service,
  date,
  time,
  notes,
  onNotesChange,
}: {
  master: BookingMaster;
  service: BookingService;
  date: Date;
  time: string;
  notes: string;
  onNotesChange: (s: string) => void;
}) {
  const duration = formatDuration(service.duration_minutes);
  const priceStr = typeof service.price === 'number' && service.price > 0
    ? formatMoney(service.price, (service.currency || 'UAH').toUpperCase())
    : null;
  const fullAddress = composeAddress(master.workplaceName, master.address, master.city);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight text-neutral-900 sm:text-[32px]">Проверьте детали</h1>

      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Услуга</p>
          <p className="mt-1 text-[15px] font-semibold text-neutral-900">{service.name?.trim() || 'Услуга'}</p>
          {duration && <p className="text-[13px] text-neutral-500">{duration}</p>}
        </div>
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Когда</p>
          <p className="mt-1 text-[15px] font-semibold text-neutral-900">
            {dateLabel(date)} в {time}
          </p>
        </div>
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Мастер</p>
          <p className="mt-1 text-[15px] font-semibold text-neutral-900">{master.displayName}</p>
          {fullAddress && <p className="text-[13px] text-neutral-500">{fullAddress}</p>}
        </div>
        {priceStr && (
          <div className="border-t border-neutral-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-neutral-900">К оплате</p>
              <p className="text-[20px] font-bold text-neutral-900">{priceStr}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
          Комментарий мастеру (необязательно)
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Особые пожелания, аллергии, удобный способ связи…"
          className="block w-full resize-none rounded-2xl border border-neutral-200 bg-white p-4 text-[14px] text-neutral-900 outline-none focus:border-neutral-400"
        />
      </div>
    </div>
  );
}

function DoneStep({
  master,
  service,
  date,
  time,
  onClose,
}: {
  master: BookingMaster;
  service: BookingService;
  date: Date;
  time: string;
  onClose: () => void;
}) {
  const address = [master.workplaceName, master.address, master.city]
    .filter(Boolean)
    .join(' · ') || null;
  return (
    <div className="mx-auto max-w-md py-8 sm:py-12">
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="size-8" />
        </div>
        <h1 className="mt-6 text-[26px] font-bold tracking-tight text-neutral-900">Запись создана!</h1>
      </div>
      <div className="mt-6 space-y-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-[14px]">
        <Row label="Мастер" value={master.displayName} />
        <Row label="Услуга" value={service.name?.trim() || 'Услуга'} />
        <Row label="Дата" value={dateLabel(date)} />
        <Row label="Время" value={time} />
        <Row label="Стоимость" value={formatMoney(service.price ?? 0, service.currency)} />
        {service.duration_minutes ? (
          <Row label="Длительность" value={formatDuration(service.duration_minutes)} />
        ) : null}
        {address ? <Row label="Адрес" value={address} /> : null}
      </div>
      <p className="mt-5 text-center text-[13px] text-neutral-500">
        Подтверждение придёт в Telegram. Если планы изменятся — отмени за сутки в разделе «Мои записи».
      </p>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-[var(--brand-radius-lg)] bg-neutral-900 px-6 text-[15px] font-semibold text-white"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function CartPanel({
  master,
  service,
  date,
  time,
  canContinue,
  onContinue,
  submitting,
  isFinal,
}: {
  master: BookingMaster;
  service: BookingService | null;
  date: Date | null;
  time: string | null;
  canContinue: boolean;
  onContinue: () => void;
  submitting: boolean;
  isFinal: boolean;
}) {
  const priceStr = service && typeof service.price === 'number' && service.price > 0
    ? formatMoney(service.price, (service.currency || 'UAH').toUpperCase())
    : null;
  const duration = formatDuration(service?.duration_minutes ?? null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        {master.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={master.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-[14px] font-bold text-neutral-700">
            {master.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-neutral-900">{master.workplaceName ?? master.displayName}</p>
          {master.city && <p className="truncate text-[12px] text-neutral-500">{master.city}</p>}
        </div>
      </div>

      <div className="my-5 border-t border-neutral-100" />

      {service ? (
        <div className="space-y-3">
          {date && time && (
            <div>
              <p className="inline-flex items-center gap-1 text-[13px] text-neutral-700">
                <Calendar className="size-3.5 text-neutral-500" />
                {dateLabel(date)} в {time}
              </p>
            </div>
          )}
          <div>
            <p className="text-[14px] font-semibold text-neutral-900">{service.name?.trim() || 'Услуга'}</p>
            <p className="text-[12px] text-neutral-500">
              {duration}
              {priceStr && <span className="float-right font-semibold text-neutral-900">{priceStr}</span>}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-neutral-500">Услуги не выбраны</p>
      )}

      <div className="mt-auto pt-6">
        {priceStr && (
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[14px] text-neutral-700">Всего к оплате</p>
            <p className="text-[18px] font-bold text-neutral-900">{priceStr}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--brand-radius-lg)] bg-neutral-900 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Сохранение…
            </>
          ) : isFinal ? (
            'Подтвердить запись'
          ) : (
            'Продолжить'
          )}
        </button>
      </div>
    </div>
  );
}
