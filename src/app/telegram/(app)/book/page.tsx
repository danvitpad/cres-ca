/** --- YAML
 * name: MiniAppBookPage
 * description: Telegram Mini App booking flow — select service (if not preselected), pick date, pick time slot, confirm. Dark theme, haptics.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Check,
  Loader2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

type Step = 'service' | 'date' | 'time' | 'confirm';

interface ServiceItem {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string;
}

interface MasterInfo {
  id: string;
  working_hours: Record<string, { start: string; end: string } | null> | null;
  display_name: string | null;
  full_name: string | null;
}

const DEFAULT_WORKING_HOURS: NonNullable<MasterInfo['working_hours']> = {
  sunday: null,
  monday: { start: '10:00', end: '19:00' },
  tuesday: { start: '10:00', end: '19:00' },
  wednesday: { start: '10:00', end: '19:00' },
  thursday: { start: '10:00', end: '19:00' },
  friday: { start: '10:00', end: '19:00' },
  saturday: { start: '11:00', end: '18:00' },
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export default function MiniAppBookPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();

  const preselectedMasterId = searchParams.get('master_id');
  const preselectedServiceId = searchParams.get('service_id');
  const rescheduleId = searchParams.get('reschedule');

  const [step, setStep] = useState<Step>('service');
  const [master, setMaster] = useState<MasterInfo | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  // Load master + services
  useEffect(() => {
    if (!preselectedMasterId) return;
    (async () => {
      const supabase = createClient();
      const { data: masterData } = await supabase
        .from('masters')
        .select('id, working_hours, display_name, profile:profiles!masters_profile_id_fkey(full_name)')
        .eq('id', preselectedMasterId)
        .single();
      if (masterData) {
        const m = masterData as unknown as {
          id: string;
          working_hours: MasterInfo['working_hours'];
          display_name: string | null;
          profile: { full_name: string } | { full_name: string }[] | null;
        };
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        setMaster({
          id: m.id,
          working_hours: m.working_hours,
          display_name: m.display_name,
          full_name: p?.full_name ?? null,
        });
      }

      const { data: serviceData } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, currency, color')
        .eq('master_id', preselectedMasterId)
        .eq('is_active', true)
        .order('name');

      if (serviceData) {
        const typed = serviceData as unknown as ServiceItem[];
        setServices(typed);
        if (preselectedServiceId) {
          const pre = typed.find((s) => s.id === preselectedServiceId);
          if (pre) {
            setSelectedService(pre);
            setStep('date');
          }
        }
      }
      setLoading(false);
    })();
  }, [preselectedMasterId, preselectedServiceId]);

  // Load slots
  const loadSlots = useCallback(async () => {
    if (!selectedDate || !selectedService || !preselectedMasterId) return;
    setSlotsLoading(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    const res = await fetch(
      `/api/slots?master_id=${preselectedMasterId}&date=${dateStr}&service_id=${selectedService.id}`,
    );
    const data = await res.json();
    setSlots(data.slots ?? []);
    setSlotsLoading(false);
  }, [selectedDate, selectedService, preselectedMasterId]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      setSelectedTime(null);
      loadSlots();
    }
  }, [selectedDate, selectedService, loadSlots]);

  const isDayOff = useCallback(
    (date: Date) => {
      if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
      const dayName = WEEKDAYS[date.getDay()];
      const wh = master?.working_hours ?? DEFAULT_WORKING_HOURS;
      return !wh[dayName];
    },
    [master],
  );

  function handleSelectService(service: ServiceItem) {
    haptic('light');
    setSelectedService(service);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep('date');
  }

  function handleSelectDate(date: Date) {
    haptic('light');
    setSelectedDate(date);
    setStep('time');
  }

  function handleSelectTime(time: string) {
    haptic('light');
    setSelectedTime(time);
    setStep('confirm');
  }

  function goBack() {
    haptic('light');
    if (step === 'confirm') setStep('time');
    else if (step === 'time') setStep('date');
    else if (step === 'date') setStep('service');
    else router.back();
  }

  async function handleConfirm() {
    if (!selectedService || !selectedDate || !selectedTime || !preselectedMasterId || !userId) return;
    setSubmitting(true);
    haptic('light');

    const supabase = createClient();
    const dateStr = selectedDate.toISOString().split('T')[0];
    const startsAt = `${dateStr}T${selectedTime}:00`;
    const [h, m] = selectedTime.split(':').map(Number);
    const endMinutes = h * 60 + m + selectedService.duration_minutes;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const endsAt = `${dateStr}T${endH}:${endM}:00`;

    // Find or create client record
    let clientId: string | null = null;
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('profile_id', userId)
      .eq('master_id', preselectedMasterId)
      .is('family_link_id', null)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId)
        .single();
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          profile_id: userId,
          master_id: preselectedMasterId,
          full_name: profile?.full_name ?? '',
          phone: profile?.phone ?? null,
        })
        .select('id')
        .single();
      clientId = newClient?.id ?? null;
    }

    if (!clientId) {
      haptic('error');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('appointments').insert({
      client_id: clientId,
      master_id: preselectedMasterId,
      service_id: selectedService.id,
      booked_via: 'telegram_miniapp',
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'booked',
      price: selectedService.price,
      currency: selectedService.currency,
    });

    if (error) {
      haptic('error');
      setSubmitting(false);
      return;
    }

    // If reschedule, cancel original
    if (rescheduleId) {
      await supabase
        .from('appointments')
        .update({
          status: 'cancelled_by_client',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: 'rescheduled',
        })
        .eq('id', rescheduleId);
    }

    // Notify master
    const { data: masterRow } = await supabase
      .from('masters')
      .select('profile_id')
      .eq('id', preselectedMasterId)
      .single();
    if (masterRow?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: masterRow.profile_id,
        channel: 'telegram',
        title: '🆕 Новая запись',
        body: `${selectedService.name} — ${selectedDate.toLocaleDateString('ru', { day: 'numeric', month: 'short' })} в ${selectedTime}`,
        scheduled_for: new Date().toISOString(),
      });
    }

    haptic('success');
    router.push('/telegram/activity');
  }

  // Calendar grid
  const calDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [calMonth]);

  if (!preselectedMasterId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 text-center">
        <p className="text-sm text-white/60">Мастер не указан</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  const masterName = master?.display_name ?? master?.full_name ?? '';
  const stepIndex = ['service', 'date', 'time', 'confirm'].indexOf(step);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-5 pb-8"
    >
      {/* Back + master name */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white/50">{masterName}</p>
          <h1 className="text-lg font-bold">
            {step === 'service' && 'Выберите услугу'}
            {step === 'date' && 'Выберите дату'}
            {step === 'time' && 'Выберите время'}
            {step === 'confirm' && 'Подтверждение'}
          </h1>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= stepIndex ? 'bg-white' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Service */}
      {step === 'service' && (
        <ul className="space-y-2">
          {services.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => handleSelectService(s)}
                className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99] transition-transform"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color || '#8b5cf6' }}
                    />
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
                    <Clock className="size-3" />
                    {s.duration_minutes} мин
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold">{Number(s.price).toFixed(0)} {s.currency}</p>
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      {/* Step 2: Date */}
      {step === 'date' && (
        <div className="space-y-4">
          {/* Selected service chip */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: selectedService?.color || '#8b5cf6' }}
            />
            <span className="font-semibold">{selectedService?.name}</span>
            <span className="text-white/40">·</span>
            <span className="text-white/60">{selectedService?.duration_minutes} мин</span>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
              className="flex size-8 items-center justify-center rounded-lg bg-white/5"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">
              {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
            </span>
            <button
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
              className="flex size-8 items-center justify-center rounded-lg bg-white/5"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const off = isDayOff(day);
              const isSelected =
                selectedDate &&
                day.toDateString() === selectedDate.toDateString();
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <button
                  key={day.toISOString()}
                  disabled={off}
                  onClick={() => handleSelectDate(day)}
                  className={`flex size-10 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-white text-black'
                      : off
                        ? 'text-white/15'
                        : isToday
                          ? 'border border-white/20 text-white'
                          : 'text-white/80 active:bg-white/10'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Time */}
      {step === 'time' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <CalendarIcon className="size-3" />
            {selectedDate?.toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'long' })}
          </div>

          {slotsLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-sm text-white/50">Нет свободных слотов на эту дату</p>
              <button
                onClick={() => setStep('date')}
                className="mt-3 text-xs font-semibold text-white/70 underline underline-offset-2"
              >
                Выбрать другую дату
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((time) => (
                <button
                  key={time}
                  onClick={() => handleSelectTime(time)}
                  className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    selectedTime === time
                      ? 'bg-white text-black'
                      : 'border border-white/10 bg-white/5 active:bg-white/10'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && selectedService && selectedDate && selectedTime && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <Row label="Услуга" value={selectedService.name} />
            <Row
              label="Дата"
              value={selectedDate.toLocaleDateString('ru', {
                day: 'numeric',
                month: 'long',
                weekday: 'short',
              })}
            />
            <Row label="Время" value={selectedTime} />
            <Row label="Длительность" value={`${selectedService.duration_minutes} мин`} />
            <div className="border-t border-white/10 pt-3">
              <Row
                label="Итого"
                value={`${Number(selectedService.price).toFixed(0)} ${selectedService.currency}`}
                bold
              />
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {submitting ? 'Бронирование...' : 'Подтвердить запись'}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-white/50">{label}</span>
      <span className={`text-right text-[13px] ${bold ? 'text-lg font-bold' : 'font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}
