/** --- YAML
 * name: MiniAppBookPage
 * description: >
 *   Telegram Mini App booking flow — 4-step wizard: services (multi-select),
 *   date (horizontal scroll + optional full calendar), time slots, confirmation.
 *   Flat cards (Phase 7.15).
 * created: 2026-04-16
 * updated: 2026-04-18
 * --- */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  X,
  Clock,
  Check,
  Plus,
  Loader2,
  Calendar as CalendarIcon,
  MapPin,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

/* ─────────────────── Types ─────────────────── */

type Step = 'services' | 'date' | 'time' | 'confirm';

interface ServiceCategory {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string | null;
  category_id: string | null;
}

interface MasterInfo {
  id: string;
  working_hours: Record<string, { start: string; end: string } | null> | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  profile_id: string | null;
  address?: string | null;
}

/* ─────────────────── Constants ─────────────────── */

const STEPS: Step[] = ['services', 'date', 'time', 'confirm'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_NAMES_SHORT: Record<string, string> = {
  sunday: 'Вс', monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср',
  thursday: 'Чт', friday: 'Пт', saturday: 'Сб',
};

const DAY_NAMES_FULL: Record<number, string> = {
  0: 'воскресенье', 1: 'понедельник', 2: 'вторник', 3: 'среда',
  4: 'четверг', 5: 'пятница', 6: 'суббота',
};

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTH_NAMES_FULL = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

const VIOLET = '#8b5cf6';
const _VIOLET_DARK = '#7c3aed';

const DEFAULT_WORKING_HOURS: NonNullable<MasterInfo['working_hours']> = {
  sunday: null,
  monday: { start: '10:00', end: '19:00' },
  tuesday: { start: '10:00', end: '19:00' },
  wednesday: { start: '10:00', end: '19:00' },
  thursday: { start: '10:00', end: '19:00' },
  friday: { start: '10:00', end: '19:00' },
  saturday: { start: '11:00', end: '18:00' },
};

/* ─────────────────── Helpers ─────────────────── */

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

function formatPrice(price: number): string {
  return Number(price).toLocaleString('ru-RU');
}

function pluralServices(count: number): string {
  if (count === 1) return 'услуга';
  if (count >= 2 && count <= 4) return 'услуги';
  return 'услуг';
}

function formatDateFull(date: Date): string {
  const day = date.getDate();
  const month = MONTH_NAMES_GENITIVE[date.getMonth()];
  const weekday = DAY_NAMES_FULL[date.getDay()];
  return `${weekday}, ${day} ${month}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60).toString().padStart(2, '0');
  const endM = (total % 60).toString().padStart(2, '0');
  return `${endH}:${endM}`;
}

function generateDateRange(startDate: Date, days: number): Date[] {
  const result: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    result.push(d);
  }
  return result;
}

/* ─────────────────── Animation Variants ─────────────────── */

const pageVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
};

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.035, duration: 0.35, ease: EASE as unknown as [number, number, number, number] },
  }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE as unknown as [number, number, number, number] } },
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function MiniAppBookPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();

  const masterId = searchParams.get('master_id');
  const preselectedServiceId = searchParams.get('service_id');
  const rescheduleId = searchParams.get('reschedule');

  /* ── State ── */
  const [step, setStep] = useState<Step>('services');
  const [direction, setDirection] = useState(1);
  const [master, setMaster] = useState<MasterInfo | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Derived ── */
  const stepIndex = STEPS.indexOf(step);
  const masterName = master?.display_name ?? master?.full_name ?? '';

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.price), 0),
    [selectedServices],
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0),
    [selectedServices],
  );

  const currency = selectedServices[0]?.currency ?? '₴';

  const filteredServices = useMemo(() => {
    if (!activeCategory) return services;
    return services.filter((s) => s.category_id === activeCategory);
  }, [services, activeCategory]);

  const horizontalDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return generateDateRange(today, 21);
  }, []);

  /* ── Load master + services + categories ── */
  useEffect(() => {
    if (!masterId) return;
    (async () => {
      const supabase = createClient();

      const { data: masterData } = await supabase
        .from('masters')
        .select('id, working_hours, display_name, profile_id, profile:profiles!masters_profile_id_fkey(full_name, avatar_url)')
        .eq('id', masterId)
        .single();

      if (masterData) {
        const m = masterData as unknown as {
          id: string;
          working_hours: MasterInfo['working_hours'];
          display_name: string | null;
          profile_id: string | null;
          profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
        };
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        setMaster({
          id: m.id,
          working_hours: m.working_hours,
          display_name: m.display_name,
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          profile_id: m.profile_id,
        });
      }

      const [{ data: serviceData }, { data: categoryData }] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, description, duration_minutes, price, currency, color, category_id')
          .eq('master_id', masterId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('service_categories')
          .select('id, name, color, sort_order')
          .eq('master_id', masterId)
          .order('sort_order'),
      ]);

      if (categoryData && categoryData.length > 0) {
        setCategories(categoryData as unknown as ServiceCategory[]);
      }

      if (serviceData) {
        const typed = serviceData as unknown as ServiceItem[];
        setServices(typed);
        if (preselectedServiceId) {
          const pre = typed.find((s) => s.id === preselectedServiceId);
          if (pre) {
            setSelectedServices([pre]);
            setStep('date');
          }
        }
      }
      setLoading(false);
    })();
  }, [masterId, preselectedServiceId]);

  /* ── Check if day is off ── */
  const isDayOff = useCallback(
    (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return true;
      const dayName = WEEKDAYS[date.getDay()];
      const wh = master?.working_hours ?? DEFAULT_WORKING_HOURS;
      return !wh[dayName];
    },
    [master],
  );

  /* ── Load time slots ── */
  const loadSlotsForDate = useCallback(async (date: Date) => {
    if (selectedServices.length === 0 || !masterId) return;
    setSlotsLoading(true);
    setNextAvailableDate(null);
    setSlots([]);

    const dateStr = date.toISOString().split('T')[0];
    // Use the first selected service for slot calculation (total duration matters)
    const res = await fetch(
      `/api/slots?master_id=${masterId}&date=${dateStr}&service_id=${selectedServices[0].id}`,
    );
    const data = await res.json();
    const fetchedSlots = data.slots ?? [];
    setSlots(fetchedSlots);

    // If no slots, find next available date
    if (fetchedSlots.length === 0) {
      for (let i = 1; i <= 30; i++) {
        const next = new Date(date);
        next.setDate(next.getDate() + i);
        if (isDayOff(next)) continue;
        const nextStr = next.toISOString().split('T')[0];
        const nextRes = await fetch(
          `/api/slots?master_id=${masterId}&date=${nextStr}&service_id=${selectedServices[0].id}`,
        );
        const nextData = await nextRes.json();
        if (nextData.slots && nextData.slots.length > 0) {
          setNextAvailableDate(next);
          break;
        }
      }
    }

    setSlotsLoading(false);
  }, [selectedServices, masterId, isDayOff]);

  // Slots are loaded via handleSelectDate and the initial load effect below
  // (avoiding setState inside useEffect for the react-hooks/set-state-in-effect rule)

  /* ── Navigation ── */
  function goToStep(target: Step) {
    const targetIdx = STEPS.indexOf(target);
    const currentIdx = STEPS.indexOf(step);
    setDirection(targetIdx > currentIdx ? 1 : -1);
    setStep(target);
  }

  function goBack() {
    haptic('light');
    if (step === 'confirm') goToStep('time');
    else if (step === 'time') goToStep('date');
    else if (step === 'date') goToStep('services');
    else router.back();
  }

  function handleClose() {
    if (selectedServices.length > 0 || selectedDate || selectedTime) {
      setShowExitModal(true);
    } else {
      router.back();
    }
  }

  function confirmExit() {
    haptic('light');
    setShowExitModal(false);
    router.back();
  }

  /* ── Service selection (multi-select) ── */
  function toggleService(service: ServiceItem) {
    haptic('light');
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) return prev.filter((s) => s.id !== service.id);
      return [...prev, service];
    });
  }

  function proceedFromServices() {
    if (selectedServices.length === 0) return;
    haptic('medium');
    setSelectedDate(null);
    setSelectedTime(null);
    goToStep('date');
  }

  /* ── Date selection ── */
  function handleSelectDate(date: Date) {
    haptic('light');
    setSelectedTime(null);
    setSelectedDate(date);
    // Load slots for this date immediately
    loadSlotsForDate(date);
  }

  function proceedFromDate() {
    if (!selectedDate) return;
    haptic('medium');
    goToStep('time');
  }

  /* ── Time selection ── */
  function handleSelectTime(time: string) {
    haptic('light');
    setSelectedTime(time);
    goToStep('confirm');
  }

  /* ── Confirmation (booking) ── */
  async function handleConfirm() {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime || !masterId || !userId) return;
    setSubmitting(true);
    haptic('medium');

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
    if (!initData) { haptic('error'); setSubmitting(false); return; }

    const dateStr = selectedDate.toISOString().split('T')[0];

    // Build appointments list (stacked sequentially)
    let currentStart = selectedTime;
    const appointments: Array<{
      service_id: string;
      starts_at: string;
      ends_at: string;
      price: number;
      currency: string;
    }> = [];
    for (const service of selectedServices) {
      const startsAt = `${dateStr}T${currentStart}:00`;
      const endTime = addMinutesToTime(currentStart, service.duration_minutes);
      const endsAt = `${dateStr}T${endTime}:00`;
      appointments.push({
        service_id: service.id,
        starts_at: startsAt,
        ends_at: endsAt,
        price: service.price,
        currency: service.currency,
      });
      currentStart = endTime;
    }

    const serviceNames = selectedServices.map((s) => s.name).join(', ');
    const dateFormatted = selectedDate.toLocaleDateString('ru', { day: 'numeric', month: 'short' });

    const res = await fetch('/api/telegram/c/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        master_id: masterId,
        appointments,
        reschedule_id: rescheduleId ?? undefined,
        service_names: serviceNames,
        date_formatted: dateFormatted,
        selected_time: selectedTime,
      }),
    });
    if (!res.ok) {
      haptic('error');
      setSubmitting(false);
      return;
    }

    haptic('success');
    router.push('/telegram/activity');
  }

  /* ── Full calendar grid ── */
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

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */

  if (!masterId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 text-center">
        <p className="text-sm text-white/60">Мастер не указан</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="size-7 animate-spin text-white/30" />
        </motion.div>
      </div>
    );
  }

  const endTime = selectedTime ? addMinutesToTime(selectedTime, totalDuration) : '';

  return (
    <>
      <div className="flex min-h-screen flex-col">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a] px-4 pb-3 pt-4"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="size-4 text-white/80" />
            </button>

            <h1 className="text-[15px] font-semibold">
              {step === 'services' && 'Услуги'}
              {step === 'date' && 'Выберите дату'}
              {step === 'time' && 'Выберите время'}
              {step === 'confirm' && 'Обзор и подтверждение'}
            </h1>

            <button
              onClick={handleClose}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
            >
              <X className="size-4 text-white/80" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s}
                className="h-[3px] flex-1 rounded-full"
                initial={false}
                animate={{
                  backgroundColor: i <= stepIndex ? VIOLET : 'rgba(255,255,255,0.08)',
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Step Content ── */}
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {/* ═══ STEP 1: Services ═══ */}
            {step === 'services' && (
              <motion.div
                key="services"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="px-4 pt-4 pb-32"
              >
                {/* Category pills */}
                {categories.length > 0 && (
                  <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                  >
                    <button
                      onClick={() => { haptic('light'); setActiveCategory(null); }}
                      className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                        !activeCategory
                          ? 'bg-white text-black'
                          : 'border border-white/10 bg-white/[0.03] text-white/70 active:bg-white/[0.06]'
                      }`}
                    >
                      Все
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { haptic('light'); setActiveCategory(cat.id); }}
                        className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                          activeCategory === cat.id
                            ? 'bg-white text-black'
                            : 'border border-white/10 bg-white/[0.03] text-white/70 active:bg-white/[0.06]'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* Service cards */}
                <div className="space-y-2.5">
                  {filteredServices.map((service, i) => {
                    const isSelected = selectedServices.some((s) => s.id === service.id);
                    return (
                      <motion.button
                        key={service.id}
                        custom={i}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        onClick={() => toggleService(service)}
                        className={`group relative flex w-full items-start gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 pl-5 text-left transition-colors active:bg-white/[0.06]`}
                      >
                        {isSelected && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-violet-500" />}
                        {/* Checkmark circle */}
                        <div className="mt-0.5 shrink-0">
                          <motion.div
                            className={`flex size-7 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                              isSelected
                                ? 'border-violet-500 bg-violet-500'
                                : 'border-white/20 bg-transparent'
                            }`}
                            animate={{ scale: isSelected ? [1, 1.15, 1] : 1 }}
                            transition={{ duration: 0.25 }}
                          >
                            {isSelected ? (
                              <Check className="size-3.5 text-white" strokeWidth={3} />
                            ) : (
                              <Plus className="size-3.5 text-white/40" strokeWidth={2} />
                            )}
                          </motion.div>
                        </div>

                        {/* Service info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold leading-tight text-white/95">
                            {service.name}
                          </p>
                          {service.description && (
                            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/40">
                              {service.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[12px] text-white/50">
                            <Clock className="size-3.5" />
                            <span>{formatDuration(service.duration_minutes)}</span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="shrink-0 pt-0.5">
                          <p className="text-[14px] font-bold text-white/90">
                            {formatPrice(Number(service.price))} {service.currency}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {services.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="mb-3 size-8 text-white/20" />
                    <p className="text-sm text-white/40">У мастера пока нет активных услуг</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 2: Date ═══ */}
            {step === 'date' && (
              <motion.div
                key="date"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="px-4 pt-4 pb-32"
              >
                {/* Month label + calendar toggle */}
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className="mb-4 flex items-center justify-between"
                >
                  <h2 className="text-[15px] font-semibold capitalize text-white/90">
                    {MONTH_NAMES_FULL[new Date().getMonth()]} {new Date().getFullYear()} г.
                  </h2>
                  <button
                    onClick={() => { haptic('light'); setShowFullCalendar(!showFullCalendar); }}
                    className={`flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition-colors active:bg-white/[0.06] ${
                      showFullCalendar ? 'text-violet-300' : 'text-white/60'
                    }`}
                  >
                    <CalendarIcon className="size-4" />
                  </button>
                </motion.div>

                <AnimatePresence mode="wait">
                  {!showFullCalendar ? (
                    /* ── Horizontal date scroll ── */
                    <motion.div
                      key="horizontal"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div
                        ref={scrollRef}
                        className="mb-5 flex gap-2.5 overflow-x-auto pb-2 scrollbar-none"
                      >
                        {horizontalDates.map((date, i) => {
                          const off = isDayOff(date);
                          const isSelected = selectedDate?.toDateString() === date.toDateString();
                          const isToday = date.toDateString() === new Date().toDateString();
                          const dayName = DAY_NAMES_SHORT[WEEKDAYS[date.getDay()]];

                          return (
                            <motion.button
                              key={date.toISOString()}
                              custom={i}
                              variants={cardVariants}
                              initial="hidden"
                              animate="visible"
                              disabled={off}
                              onClick={() => handleSelectDate(date)}
                              className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl px-3 py-3 transition-colors ${
                                isSelected
                                  ? 'bg-violet-500'
                                  : off
                                    ? 'opacity-30'
                                    : isToday
                                      ? 'border border-white/20 bg-white/[0.03]'
                                      : 'border border-white/10 bg-white/[0.03] active:bg-white/[0.06]'
                              }`}
                              style={{ minWidth: 56 }}
                            >
                              <span className={`text-[11px] font-medium ${
                                isSelected ? 'text-white/80' : 'text-white/40'
                              }`}>
                                {dayName}
                              </span>
                              <span className={`text-[18px] font-bold leading-none ${
                                isSelected ? 'text-white' : off ? 'text-white/30' : 'text-white/90'
                              }`}>
                                {date.getDate()}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    /* ── Full calendar ── */
                    <motion.div
                      key="fullcalendar"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mb-5"
                    >
                      {/* Month nav */}
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                          className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <span className="text-[13px] font-semibold capitalize">
                          {MONTH_NAMES_FULL[calMonth.getMonth()]} {calMonth.getFullYear()}
                        </span>
                        <button
                          onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                          className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>

                      {/* Day names */}
                      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-white/30">
                        {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((d) => (
                          <div key={d}>{d}</div>
                        ))}
                      </div>

                      {/* Days grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {calDays.map((day, i) => {
                          if (!day) return <div key={`e-${i}`} />;
                          const off = isDayOff(day);
                          const isSelected = selectedDate?.toDateString() === day.toDateString();
                          const isToday = day.toDateString() === new Date().toDateString();
                          return (
                            <button
                              key={day.toISOString()}
                              disabled={off}
                              onClick={() => handleSelectDate(day)}
                              className={`flex size-10 items-center justify-center rounded-xl text-[13px] font-medium transition-colors ${
                                isSelected
                                  ? 'bg-violet-500 text-white'
                                  : off
                                    ? 'text-white/15'
                                    : isToday
                                      ? 'border border-white/20 text-white'
                                      : 'text-white/70 active:bg-white/[0.06]'
                              }`}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected date context + available slots preview */}
                {selectedDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <p className="text-[13px] font-medium capitalize text-white/70">
                      {formatDateFull(selectedDate)}
                    </p>
                    {slotsLoading ? (
                      <div className="mt-3 flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin text-white/30" />
                        <span className="text-[12px] text-white/40">Загружаем слоты...</span>
                      </div>
                    ) : slots.length > 0 ? (
                      <p className="mt-1.5 text-[12px] text-white/40">
                        {slots.length} {slots.length === 1 ? 'свободный слот' : slots.length < 5 ? 'свободных слота' : 'свободных слотов'}
                      </p>
                    ) : (
                      <div className="mt-3 text-center">
                        <CalendarIcon className="mx-auto mb-2 size-8 text-white/15" />
                        <p className="text-[13px] font-medium text-white/50">
                          Специалист полностью забронирован на эту дату
                        </p>
                        {nextAvailableDate && (
                          <p className="mt-1 text-[12px] text-white/30">
                            Доступно с {nextAvailableDate.getDate()} {MONTH_NAMES_GENITIVE[nextAvailableDate.getMonth()]}
                          </p>
                        )}
                        <div className="mt-3 flex flex-col gap-2">
                          {nextAvailableDate && (
                            <button
                              onClick={() => { haptic('light'); handleSelectDate(nextAvailableDate); }}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-violet-300 active:bg-white/[0.06] transition-colors"
                            >
                              Перейти к следующей доступной дате
                            </button>
                          )}
                          <button className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-white/50 active:bg-white/[0.06] transition-colors">
                            Записаться в список ожидания
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 3: Time ═══ */}
            {step === 'time' && (
              <motion.div
                key="time"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="px-4 pt-4 pb-32"
              >
                {/* Date context */}
                {selectedDate && (
                  <motion.p
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="mb-5 text-[14px] font-medium capitalize text-white/60"
                  >
                    {formatDateFull(selectedDate)}
                  </motion.p>
                )}

                {slotsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.03]" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center"
                  >
                    <CalendarIcon className="mb-3 size-10 text-white/15" />
                    <p className="text-[14px] font-medium text-white/50">
                      Нет свободных слотов
                    </p>
                    <button
                      onClick={() => goToStep('date')}
                      className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[13px] font-semibold text-white/70 active:bg-white/[0.06] transition-colors"
                    >
                      Выбрать другую дату
                    </button>
                    <button className="mt-3 text-[12px] font-medium text-violet-300 transition-opacity active:opacity-60">
                      Записаться в список ожидания
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-2.5">
                    {slots.map((time, i) => {
                      const isSelected = selectedTime === time;
                      const slotEnd = addMinutesToTime(time, totalDuration);
                      return (
                        <motion.button
                          key={time}
                          custom={i}
                          variants={cardVariants}
                          initial="hidden"
                          animate="visible"
                          onClick={() => handleSelectTime(time)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 transition-colors ${
                            isSelected
                              ? 'border-white/20 bg-white text-black'
                              : 'border-white/10 bg-white/[0.03] text-white active:bg-white/[0.06]'
                          }`}
                        >
                          <span className={`text-[17px] font-bold ${isSelected ? 'text-black' : ''}`}>
                            {time}
                          </span>
                          <span className={`text-[13px] ${isSelected ? 'text-black/50' : 'text-white/30'}`}>
                            до {slotEnd}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Waitlist hint */}
                {slots.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 text-center text-[12px] text-white/30"
                  >
                    Не можете найти подходящее время?{' '}
                    <button className="font-medium text-violet-300 transition-opacity active:opacity-60">
                      Записаться в список ожидания
                    </button>
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 4: Confirmation ═══ */}
            {step === 'confirm' && selectedDate && selectedTime && (
              <motion.div
                key="confirm"
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="px-4 pt-4 pb-36"
              >
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  {/* Master info */}
                  <div className="flex items-center gap-3.5 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
                      {master?.avatar_url ? (
                        <Image
                          src={master.avatar_url}
                          alt=""
                          width={48}
                          height={48}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-[16px] font-bold text-white/90">
                          {masterName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-white/95">{masterName}</p>
                      {master?.address && (
                        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-white/40">
                          <MapPin className="size-3" />
                          <span className="truncate">{master.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mx-5 h-px bg-white/10" />

                  {/* Date & Time */}
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                        <CalendarIcon className="size-4 text-violet-300" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
                          Дата
                        </p>
                        <p className="text-[14px] font-semibold capitalize text-white/90">
                          {formatDateFull(selectedDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                        <Clock className="size-4 text-violet-300" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
                          Время
                        </p>
                        <p className="text-[14px] font-semibold text-white/90">
                          {selectedTime}–{endTime}{' '}
                          <span className="font-normal text-white/40">
                            (длительность {formatDuration(totalDuration)})
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mx-5 h-px bg-white/10" />

                  {/* Services breakdown */}
                  <div className="space-y-3 p-5">
                    {selectedServices.map((service) => {
                      return (
                        <div key={service.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-white/90">
                              {service.name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-white/35">
                              {formatDuration(service.duration_minutes)} с {masterName}
                            </p>
                          </div>
                          <p className="shrink-0 text-[14px] font-bold text-white/80">
                            {formatPrice(Number(service.price))} {service.currency}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mx-5 h-px bg-white/10" />

                  {/* Total */}
                  <div className="flex items-center justify-between p-5">
                    <p className="text-[14px] font-medium text-white/60">Всего к оплате</p>
                    <p className="text-[20px] font-bold text-white">
                      {formatPrice(totalPrice)} {currency}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Sticky Footer ── */}
        <AnimatePresence>
          {step === 'services' && (
            <motion.div
              key="footer-services"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0a] px-4 pb-8 pt-4"
            >
              {selectedServices.length > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 text-center text-[13px] text-white/50"
                >
                  {formatPrice(totalPrice)} {currency} · {selectedServices.length}{' '}
                  {pluralServices(selectedServices.length)} · {formatDuration(totalDuration)}
                </motion.p>
              )}
              <button
                onClick={proceedFromServices}
                disabled={selectedServices.length === 0}
                className={`flex w-full items-center justify-center rounded-2xl py-4 text-[15px] font-semibold transition-colors ${
                  selectedServices.length > 0
                    ? 'bg-white text-black active:bg-white/80'
                    : 'bg-white/[0.03] text-white/25'
                }`}
              >
                Продолжить
              </button>
            </motion.div>
          )}

          {step === 'date' && (
            <motion.div
              key="footer-date"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0a] px-4 pb-8 pt-4"
            >
              <button
                onClick={proceedFromDate}
                disabled={!selectedDate || (slots.length === 0 && !slotsLoading)}
                className={`flex w-full items-center justify-center rounded-2xl py-4 text-[15px] font-semibold transition-colors ${
                  selectedDate && slots.length > 0
                    ? 'bg-white text-black active:bg-white/80'
                    : 'bg-white/[0.03] text-white/25'
                }`}
              >
                Продолжить
              </button>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div
              key="footer-confirm"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0a] px-4 pb-8 pt-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] text-white/40">К оплате в магазине</span>
                <span className="text-[16px] font-bold text-white">
                  {formatPrice(totalPrice)} {currency}
                </span>
              </div>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:bg-white/80 transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" strokeWidth={2.5} />
                )}
                {submitting ? 'Бронирование...' : 'Подтвердить'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Exit Confirmation Modal ── */}
      <AnimatePresence>
        {showExitModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowExitModal(false)}
              className="fixed inset-0 z-50 bg-black/70"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-white/10 bg-[#1f2023] px-5 pb-10 pt-6"
            >
              {/* Handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />

              <h3 className="text-center text-[17px] font-bold text-white">
                Вы точно хотите прервать это бронирование?
              </h3>
              <p className="mt-2 text-center text-[14px] text-white/40">
                Все выбранные параметры будут сброшены.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { haptic('light'); setShowExitModal(false); }}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 text-[14px] font-semibold text-white/70 active:bg-white/[0.06] transition-colors"
                >
                  Отменить
                </button>
                <button
                  onClick={confirmExit}
                  className="flex-1 rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-black active:bg-white/80 transition-colors"
                >
                  Выйти
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
