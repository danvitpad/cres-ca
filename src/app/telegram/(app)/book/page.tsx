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
import Link from 'next/link';
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
  CalendarPlus,
  MapPin,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Info,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T } from '@/components/miniapp/design';
import { formatMoney } from '@/lib/format/money';
import { showMainButton, hideMainButton, setMainButtonLoading, isTelegram, tg } from '@/lib/telegram/webapp';

/* ─────────────────── Types ─────────────────── */

type Step = 'services' | 'datetime' | 'confirm';

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
  booking_important_info?: string | null;
}

/* ─────────────────── Constants ─────────────────── */

const STEPS: Step[] = ['services', 'datetime', 'confirm'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_NAMES_SHORT_BY_LANG: Record<'uk' | 'ru' | 'en', Record<string, string>> = {
  uk: { sunday: 'Нд', monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт', saturday: 'Сб' },
  ru: { sunday: 'Вс', monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт', saturday: 'Сб' },
  en: { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' },
};

const DAY_NAMES_SHORT: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, p) { return DAY_NAMES_SHORT_BY_LANG[getBookLocale()][String(p)]; },
});

const CALENDAR_HEADER_BY_LANG: Record<'uk' | 'ru' | 'en', string[]> = {
  uk: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const STR = {
  uk: {
    masterNotFound: 'Майстер не вказаний',
    stepServices: 'Послуги',
    stepDatetime: 'Дата і час',
    stepConfirm: 'Підтвердження',
    all: 'Усі',
    noActiveServices: 'У майстра поки немає активних послуг',
    yearSuffix: ' р.',
    noFreeSlots: 'Немає вільних слотів',
    dayOff: 'вих.',
    nearest: 'Найближча:',
    pastSlot: 'Цей час вже минув',
    bookedSlot: 'Цей час вже зайнятий',
    tooShortSlot: 'Послуга не вміщується у цей час',
    pastSlotsHint: 'Сьогодні всі слоти вже минули. Виберіть інший день вище.',
    dateLabel: 'Дата',
    timeLabel: 'Час',
    duration: 'тривалість',
    withMaster: (n: string) => `з ${n}`,
    totalToPay: 'Всього до сплати',
    importantInfo: 'Важлива інформація',
    continue: 'Продовжити',
    payInShop: 'До сплати на місці',
    booking: 'Бронюємо...',
    confirm: 'Підтвердити',
    exitTitle: 'Ви точно хочете перервати це бронювання?',
    exitDesc: 'Усі вибрані параметри буде скинуто.',
    cancel: 'Скасувати',
    exit: 'Вийти',
    joinWaitlist: 'Встати в чергу',
    waitlistJoined: 'Ви в черзі! Повідомимо коли зʼявиться слот.',
    waitlistAlready: 'Ви вже в черзі',
    upsellLabel: 'Часто додають:',
    giftCertPlaceholder: 'Код сертифіката',
    giftCertApply: 'Застосувати',
    giftCertApplied: (amt: string) => `Сертифікат: −${amt}`,
    giftCertRemove: 'Видалити',
    giftCertInvalid: 'Сертифікат не знайдено або вже використано',
    giftCertChecking: 'Перевірка...',
    successTitle: 'Записано!',
    successSub: 'Запис успішно додано',
    viewBookings: 'Мої записи',
    addAnotherMaster: 'Додати ще майстра на цей день',
    shareBooking: 'Поділитися',
    addToCalendar: 'Додати в календар',
  },
  ru: {
    masterNotFound: 'Мастер не указан',
    stepServices: 'Услуги',
    stepDatetime: 'Дата и время',
    stepConfirm: 'Подтверждение',
    all: 'Все',
    noActiveServices: 'У мастера пока нет активных услуг',
    yearSuffix: ' г.',
    noFreeSlots: 'Нет свободных слотов',
    dayOff: 'вых.',
    nearest: 'Ближайшая:',
    pastSlot: 'Это время уже прошло',
    bookedSlot: 'Это время уже занято',
    tooShortSlot: 'Услуга не помещается в это время',
    pastSlotsHint: 'Сегодня все слоты уже прошли. Выберите другой день выше.',
    dateLabel: 'Дата',
    timeLabel: 'Время',
    duration: 'длительность',
    withMaster: (n: string) => `с ${n}`,
    totalToPay: 'Всего к оплате',
    importantInfo: 'Важная информация',
    continue: 'Продолжить',
    payInShop: 'К оплате в магазине',
    booking: 'Бронирование...',
    confirm: 'Подтвердить',
    exitTitle: 'Вы точно хотите прервать это бронирование?',
    exitDesc: 'Все выбранные параметры будут сброшены.',
    cancel: 'Отменить',
    exit: 'Выйти',
    joinWaitlist: 'Встать в очередь',
    waitlistJoined: 'Вы в очереди! Уведомим когда появится слот.',
    waitlistAlready: 'Вы уже в очереди',
    upsellLabel: 'Часто добавляют:',
    giftCertPlaceholder: 'Код сертификата',
    giftCertApply: 'Применить',
    giftCertApplied: (amt: string) => `Сертификат: −${amt}`,
    giftCertRemove: 'Удалить',
    giftCertInvalid: 'Сертификат не найден или уже использован',
    giftCertChecking: 'Проверка...',
    successTitle: 'Готово!',
    successSub: 'Запись успешно создана',
    viewBookings: 'Мои записи',
    addAnotherMaster: 'Добавить ещё мастера на этот день',
    shareBooking: 'Поделиться',
    addToCalendar: 'Добавить в календарь',
  },
  en: {
    masterNotFound: 'Master not specified',
    stepServices: 'Services',
    stepDatetime: 'Date & time',
    stepConfirm: 'Confirmation',
    all: 'All',
    noActiveServices: 'This master has no active services yet',
    yearSuffix: '',
    noFreeSlots: 'No free slots',
    dayOff: 'off',
    nearest: 'Nearest:',
    pastSlot: 'This time has already passed',
    bookedSlot: 'This time is already booked',
    tooShortSlot: 'Service does not fit in this time',
    pastSlotsHint: 'All slots for today have passed. Pick another day above.',
    dateLabel: 'Date',
    timeLabel: 'Time',
    duration: 'duration',
    withMaster: (n: string) => `with ${n}`,
    totalToPay: 'Total',
    importantInfo: 'Important info',
    continue: 'Continue',
    payInShop: 'Pay in shop',
    booking: 'Booking...',
    confirm: 'Confirm',
    exitTitle: 'Are you sure you want to cancel this booking?',
    exitDesc: 'All selected options will be cleared.',
    cancel: 'Cancel',
    exit: 'Exit',
    joinWaitlist: 'Join waitlist',
    waitlistJoined: "You're on the waitlist! We'll notify you when a slot opens.",
    waitlistAlready: "You're already on the waitlist",
    upsellLabel: 'Often added:',
    giftCertPlaceholder: 'Gift card code',
    giftCertApply: 'Apply',
    giftCertApplied: (amt: string) => `Gift card: −${amt}`,
    giftCertRemove: 'Remove',
    giftCertInvalid: 'Certificate not found or already used',
    giftCertChecking: 'Checking...',
    successTitle: 'Booked!',
    successSub: 'Your appointment is confirmed',
    viewBookings: 'My bookings',
    addAnotherMaster: 'Add another master for the same day',
    shareBooking: 'Share',
    addToCalendar: 'Add to calendar',
  },
} as const;

type BookLang = 'uk' | 'ru' | 'en';

function getBookLocale(): BookLang {
  if (typeof window === 'undefined') return 'uk';
  try {
    const stored = localStorage.getItem('cres:locale');
    if (stored === 'ru' || stored === 'en' || stored === 'uk') return stored;
  } catch {}
  return 'uk';
}

const DAY_NAMES_FULL_BY_LANG: Record<BookLang, Record<number, string>> = {
  uk: {
    0: 'неділя', 1: 'понеділок', 2: 'вівторок', 3: 'середа',
    4: 'четвер', 5: 'пʼятниця', 6: 'субота',
  },
  ru: {
    0: 'воскресенье', 1: 'понедельник', 2: 'вторник', 3: 'среда',
    4: 'четверг', 5: 'пятница', 6: 'суббота',
  },
  en: {
    0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
    4: 'Thursday', 5: 'Friday', 6: 'Saturday',
  },
};

const MONTH_NAMES_GENITIVE_BY_LANG: Record<BookLang, string[]> = {
  uk: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
       'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
       'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
};

const MONTH_NAMES_FULL_BY_LANG: Record<BookLang, string[]> = {
  uk: ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
       'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'],
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
       'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
};

// Backward-compat single accessors — выбирают по текущему языку из localStorage.
const DAY_NAMES_FULL: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, p) { return DAY_NAMES_FULL_BY_LANG[getBookLocale()][Number(p)]; },
});
const MONTH_NAMES_GENITIVE: string[] = new Proxy([] as string[], {
  get(_t, p) {
    if (p === 'length') return 12;
    return MONTH_NAMES_GENITIVE_BY_LANG[getBookLocale()][Number(p)];
  },
});
const MONTH_NAMES_FULL: string[] = new Proxy([] as string[], {
  get(_t, p) {
    if (p === 'length') return 12;
    return MONTH_NAMES_FULL_BY_LANG[getBookLocale()][Number(p)];
  },
});

const VIOLET = '#2dd4bf';
const _VIOLET_DARK = 'var(--color-accent)';

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
  const lang = getBookLocale();
  const HOUR: Record<BookLang, string> = { uk: 'год', ru: 'ч', en: 'h' };
  const MIN: Record<BookLang, string> = { uk: 'хв', ru: 'мин', en: 'min' };
  if (mins < 60) return `${mins} ${MIN[lang]}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} ${HOUR[lang]}`;
  return `${h} ${HOUR[lang]} ${m} ${MIN[lang]}`;
}

function formatPrice(price: number): string {
  const lang = getBookLocale();
  const LOC: Record<BookLang, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };
  return Number(price).toLocaleString(LOC[lang]);
}

function pluralServices(count: number): string {
  const lang = getBookLocale();
  if (lang === 'en') return count === 1 ? 'service' : 'services';
  // Both ru and uk use Slavic plurals: 1 → одна, 2-4 → две, 5+ → много
  // Грамматически совпадают для услуга/послуга.
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return lang === 'uk' ? 'послуга' : 'услуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return lang === 'uk' ? 'послуги' : 'услуги';
  }
  return lang === 'uk' ? 'послуг' : 'услуг';
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

/** YYYY-MM-DD из ЛОКАЛЬНЫХ компонент даты. Нельзя использовать
 *  date.toISOString().split('T')[0] — оно конвертит в UTC и для UA (UTC+3)
 *  суббота 2 мая 00:00 локально → пятница 1 мая 21:00 UTC → "2026-05-01".
 *  Из-за этого клиент видел запись на 2 мая, а в БД летело 1 мая. */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** UTC ISO timestamp из (Date, "HH:MM") локального настенного времени.
 *  Постгрес-колонка timestamptz парсит ISO без суффикса как UTC, поэтому
 *  "2026-05-02T14:00:00" в UA (UTC+3) трактовалось как 14:00 UTC = 17:00 Kyiv.
 *  Клиент бронировал 14:00, а в карточке отображалось 17:00. */
function toUtcIsoFromLocal(date: Date, hhmm: string): string {
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
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

  // Accept both `master_id`/`master` and `service_id`/`service` for compatibility
  // with TG bot deep-links (waitlist match URL uses short `master=` / `service=`).
  const masterId = searchParams.get('master_id') ?? searchParams.get('master');
  const preselectedServiceId = searchParams.get('service_id') ?? searchParams.get('service');
  const rescheduleId = searchParams.get('reschedule');
  const incomingGroupBookingId = searchParams.get('group_booking_id');
  const incomingGroupDate = searchParams.get('date');
  // ID waitlist-record когда клиент пришёл из «🟢 Слот відкрився» уведомления.
  // Передаётся в /api/telegram/c/book — закрепит новый apt за waitlist-row +
  // мастер увидит «Запис із листа очікування» в TG-уведомлении.
  const fromWaitlist = searchParams.get('from_waitlist');

  /* ── State ── */
  const [step, setStep] = useState<Step>('services');
  const [direction, setDirection] = useState(1);
  const [master, setMaster] = useState<MasterInfo | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (!incomingGroupDate) return null;
    const parsed = new Date(incomingGroupDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  });
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [pastSlots, setPastSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [tooShortSlots, setTooShortSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [upsellSuggestions, setUpsellSuggestions] = useState<ServiceItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookedGroupId, setBookedGroupId] = useState<string | null>(null);
  const [giftCertCode, setGiftCertCode] = useState('');
  const [giftCertDiscount, setGiftCertDiscount] = useState<number | null>(null);
  const [giftCertCheckingState, setGiftCertCheckingState] = useState(false);
  const [giftCertError, setGiftCertError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Derived ── */
  const stepIndex = STEPS.indexOf(step);
  const masterName = master?.display_name ?? master?.full_name ?? '';
  const lang = getBookLocale();
  const t = STR[lang];

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.price), 0),
    [selectedServices],
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0),
    [selectedServices],
  );

  const currency = selectedServices[0]?.currency ?? '₴';

  // Fetch upsell suggestions when the first service is selected
  const firstSelectedId = selectedServices[0]?.id;
  useEffect(() => {
    setUpsellSuggestions([]);
    if (!masterId || !firstSelectedId) return;
    fetch(`/api/telegram/c/upsell?master_id=${masterId}&service_id=${firstSelectedId}`)
      .then((r) => r.json())
      .then((d: { suggestions?: ServiceItem[] }) => {
        const filtered = (d.suggestions ?? []).filter(
          (s) => !selectedServices.some((sel) => sel.id === s.id),
        );
        setUpsellSuggestions(filtered);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterId, firstSelectedId]);

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
        .select('id, working_hours, display_name, profile_id, booking_important_info, profile:profiles!masters_profile_id_fkey(full_name, avatar_url)')
        .eq('id', masterId)
        .single();

      if (masterData) {
        const m = masterData as unknown as {
          id: string;
          working_hours: MasterInfo['working_hours'];
          display_name: string | null;
          profile_id: string | null;
          booking_important_info: string | null;
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
          booking_important_info: m.booking_important_info,
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
            setStep('datetime');
          }
        }
      }
      setLoading(false);
    })();
  }, [masterId, preselectedServiceId]);

  /* ── Check if day is off ── */
  // Поддерживаем оба формата working_hours: старый { start, end } и новый
  // мульти-интервальный { enabled, intervals: [...] }. Без этого все дни
  // рендерились как off — { enabled, intervals } truthy, но мы не учитывали
  // enabled=false (выходной) и пустой intervals[].
  const isDayOff = useCallback(
    (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return true;
      const dayName = WEEKDAYS[date.getDay()];
      const whRaw = master?.working_hours as unknown as Record<string, unknown> | null | undefined;
      const wh = whRaw && Object.keys(whRaw).length > 0 ? whRaw : (DEFAULT_WORKING_HOURS as unknown as Record<string, unknown>);
      const entry = wh[dayName];
      if (!entry || typeof entry !== 'object') return true;
      const e = entry as { enabled?: boolean; intervals?: unknown[]; start?: string; end?: string };
      // Новый формат
      if ('intervals' in e) {
        if (e.enabled === false) return true;
        return !Array.isArray(e.intervals) || e.intervals.length === 0;
      }
      // Старый формат — start/end должны быть строками
      return !e.start || !e.end;
    },
    [master],
  );

  /* ── Load time slots ── */
  const loadSlotsForDate = useCallback(async (date: Date) => {
    if (selectedServices.length === 0 || !masterId) return;
    setSlotsLoading(true);
    setNextAvailableDate(null);
    setSlots([]);
    setPastSlots([]);
    setBookedSlots([]);
    setTooShortSlots([]);

    const dateStr = toLocalDateStr(date);
    // Use the first selected service for slot calculation (total duration matters)
    const res = await fetch(
      `/api/slots?master_id=${masterId}&date=${dateStr}&service_id=${selectedServices[0].id}`,
    );
    const data = await res.json();
    const fetchedSlots = data.slots ?? [];
    const fetchedPast = data.pastSlots ?? [];
    const fetchedBooked = data.bookedSlots ?? [];
    const fetchedTooShort = data.tooShortSlots ?? [];
    setSlots(fetchedSlots);
    setPastSlots(fetchedPast);
    setBookedSlots(fetchedBooked);
    setTooShortSlots(fetchedTooShort);

    // If no slots, find next available date
    if (fetchedSlots.length === 0) {
      for (let i = 1; i <= 30; i++) {
        const next = new Date(date);
        next.setDate(next.getDate() + i);
        if (isDayOff(next)) continue;
        const nextStr = toLocalDateStr(next);
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

  /* ── Telegram MainButton — confirm step ── */
  // Keep a stable ref so the onClick closure doesn't stale.
  const handleConfirmRef = useRef(handleConfirm);
  useEffect(() => { handleConfirmRef.current = handleConfirm; });

  useEffect(() => {
    if (step !== 'confirm') {
      hideMainButton();
      return;
    }
    const cb = () => handleConfirmRef.current();
    showMainButton(t.confirm, cb);
    return () => {
      // Telegram SDK: offClick needs the same function reference
      const w = (typeof window !== 'undefined' ? window : null) as { Telegram?: { WebApp?: { MainButton?: { offClick?: (fn: () => void) => void; hide?: () => void } } } } | null;
      w?.Telegram?.WebApp?.MainButton?.offClick?.(cb);
      hideMainButton();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, t.confirm]);

  useEffect(() => {
    if (step === 'confirm') setMainButtonLoading(submitting);
  }, [submitting, step]);

  /* ── Navigation ── */
  function goToStep(target: Step) {
    const targetIdx = STEPS.indexOf(target);
    const currentIdx = STEPS.indexOf(step);
    setDirection(targetIdx > currentIdx ? 1 : -1);
    setStep(target);
  }

  function goBack() {
    haptic('light');
    if (step === 'confirm') goToStep('datetime');
    else if (step === 'datetime') goToStep('services');
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
    goToStep('datetime');
  }

  /* ── Date selection ── */
  function handleSelectDate(date: Date) {
    haptic('light');
    setSelectedTime(null);
    setSelectedDate(date);
    setWaitlistJoined(false);
    // Load slots for this date immediately
    loadSlotsForDate(date);
  }

  /* ── Waitlist ── */
  async function handleJoinWaitlist() {
    if (!masterId || waitlistJoining || waitlistJoined) return;
    setWaitlistJoining(true);
    haptic('light');

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
      } catch {}
      return null;
    })();

    const res = await fetch('/api/telegram/c/waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-TG-Init-Data': initData } : {}),
      },
      body: JSON.stringify({
        master_id: masterId,
        service_id: selectedServices[0]?.id ?? null,
      }),
    }).catch(() => null);

    setWaitlistJoining(false);
    if (res?.ok) {
      haptic('success');
      setWaitlistJoined(true);
    } else {
      haptic('error');
    }
  }

  /* ── Time selection (auto-advances to confirm) ── */
  function handleSelectTime(time: string) {
    haptic('light');
    setSelectedTime(time);
    goToStep('confirm');
    // Fire-and-forget: save draft so abandoned-booking cron can send a recovery push
    if (masterId && selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const slotDate = `${y}-${m}-${d}`;
      const w = typeof window !== 'undefined' ? (window as { Telegram?: { WebApp?: { initData?: string } } }) : null;
      const liveId = w?.Telegram?.WebApp?.initData ?? null;
      const stashedId = (() => {
        try {
          const s = sessionStorage.getItem('cres:tg');
          return s ? (JSON.parse(s) as { initData?: string }).initData ?? null : null;
        } catch { return null; }
      })();
      const draftInitData = liveId ?? stashedId;
      fetch('/api/telegram/c/booking-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(draftInitData ? { 'X-TG-Init-Data': draftInitData } : {}),
        },
        body: JSON.stringify({
          master_id: masterId,
          service_id: selectedServices[0]?.id ?? null,
          slot_date: slotDate,
          slot_time: time,
        }),
      }).catch(() => null);
    }
  }

  /* ── Gift certificate validation ── */
  async function handleApplyGiftCert() {
    const code = giftCertCode.trim().toUpperCase();
    if (!code || !masterId) return;
    haptic('light');
    setGiftCertCheckingState(true);
    setGiftCertError('');
    const res = await fetch(
      `/api/telegram/c/gift-cert?code=${encodeURIComponent(code)}&master_id=${masterId}`,
    ).catch(() => null);
    setGiftCertCheckingState(false);
    if (!res?.ok) { setGiftCertError(t.giftCertInvalid); haptic('error'); return; }
    const data = await res.json() as { valid?: boolean; amount?: number };
    if (!data.valid || !data.amount) { setGiftCertError(t.giftCertInvalid); haptic('error'); return; }
    haptic('success');
    setGiftCertDiscount(data.amount);
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
      const startsAt = toUtcIsoFromLocal(selectedDate, currentStart);
      const endTime = addMinutesToTime(currentStart, service.duration_minutes);
      const endsAt = toUtcIsoFromLocal(selectedDate, endTime);
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
    const localeMap: Record<BookLang, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };
    const dateFormatted = selectedDate.toLocaleDateString(localeMap[lang], { day: 'numeric', month: 'short' });

    // Партнёрский ref: если клиент перешёл с другой публичной страницы через
    // ?from=<master_id>, PartnerRefCapture сохранил его в sessionStorage.
    // Бэкенд проверит активность партнёрства и проставит referrer_master_id.
    const partnerRef = (() => {
      try { return window.sessionStorage.getItem('cres_partner_ref'); } catch { return null; }
    })();

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
        partner_ref_master_id: partnerRef ?? undefined,
        gift_cert_code: giftCertDiscount ? giftCertCode.trim().toUpperCase() : undefined,
        group_booking_id: incomingGroupBookingId ?? undefined,
        from_waitlist: fromWaitlist ?? undefined,
      }),
    });
    if (!res.ok) {
      haptic('error');
      setSubmitting(false);
      return;
    }

    const result = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      appointmentIds?: string[];
      depositsRequired?: Array<{ appointment_id: string; amount: number; currency: string; reason: string | null }>;
      groupBookingId?: string;
    };

    haptic('success');

    // After 2nd successful booking, prompt to add the Mini App to home screen.
    try {
      const key = 'cres:bookings_done';
      const prev = parseInt(localStorage.getItem(key) ?? '0', 10);
      const next = prev + 1;
      localStorage.setItem(key, String(next));
      if (next === 2) {
        // requestFullscreen is already active; addToHomeScreen shows native dialog
        (window as { Telegram?: { WebApp?: { addToHomeScreen?: () => void } } })
          .Telegram?.WebApp?.addToHomeScreen?.();
      }
    } catch {}

    // Mark draft as converted (fire-and-forget)
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      fetch('/api/telegram/c/booking-draft', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({
          master_id: masterId,
          slot_date: `${y}-${m}-${d}`,
          slot_time: selectedTime,
        }),
      }).catch(() => null);
    }

    // If any appointment requires a deposit — create intent + redirect to Hutko immediately.
    // We kick off deposit for the FIRST appointment; follow-ups handled individually.
    const deposit = result.depositsRequired?.[0];
    if (deposit) {
      try {
        const payRes = await fetch('/api/payments/deposit/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: deposit.appointment_id }),
        });
        const payData = (await payRes.json().catch(() => ({}))) as { checkoutUrl?: string };
        if (payRes.ok && payData.checkoutUrl) {
          window.location.href = payData.checkoutUrl;
          return;
        }
      } catch (e) {
        console.error('[book] deposit init failed', e);
      }
    }

    setBookedGroupId(result.groupBookingId ?? null);
    setShowSuccess(true);
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
        <p className="text-sm" style={{ color: T.textSecondary }}>{t.masterNotFound}</p>
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
          <Loader2 className="size-7 animate-spin text-neutral-400" />
        </motion.div>
      </div>
    );
  }

  const endTime = selectedTime ? addMinutesToTime(selectedTime, totalDuration) : '';

  if (showSuccess) {
    const dateStr = selectedDate
      ? selectedDate.toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })
      : '';
    const bookingMasterName = master?.display_name ?? master?.full_name ?? '';

    function addToGoogleCalendar() {
      haptic('medium');
      if (!selectedDate || !selectedTime) return;
      const [h, m] = selectedTime.split(':').map(Number);
      const startDt = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m);
      const endDt = new Date(startDt.getTime() + totalDuration * 60000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const fmt = (d: Date) =>
        d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
      const title = selectedServices.map((s) => s.name).join(', ') + (bookingMasterName ? ` — ${bookingMasterName}` : '');
      const masterLabel = lang === 'uk' ? 'Майстер' : lang === 'ru' ? 'Мастер' : 'Master';
      const details = bookingMasterName ? `${masterLabel}: ${bookingMasterName}` : '';
      const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${fmt(startDt)}/${fmt(endDt)}` });
      if (details) params.set('details', details);
      if (master?.address) params.set('location', master.address);
      tg()?.openLink('https://calendar.google.com/calendar/render?' + params.toString());
    }

    function shareBookingToTG() {
      haptic('medium');
      const emoji = lang === 'en' ? '✅' : '✅';
      const lines: string[] = [emoji + ' ' + t.successTitle];
      if (bookingMasterName) lines.push('👤 ' + bookingMasterName);
      if (dateStr && selectedTime) lines.push('📅 ' + dateStr + ', ' + selectedTime);
      if (selectedServices.length) lines.push('💆 ' + selectedServices.map((s) => s.name).join(', '));
      const msg = lines.join('\n');
      tg()?.openTelegramLink('https://t.me/share/url?url=&text=' + encodeURIComponent(msg));
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" style={{ background: T.bg }}>
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, stiffness: 200 }}>
          <div className="mb-4 flex size-16 items-center justify-center rounded-full" style={{ background: T.accentSoft }}>
            <CheckCircle2 className="size-8" style={{ color: T.accent }} />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h1 className="text-[22px] font-bold" style={{ color: T.text }}>{t.successTitle}</h1>
          <p className="mt-1 text-[14px]" style={{ color: T.textSecondary }}>{t.successSub}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex w-full max-w-xs flex-col gap-3">
          {bookedGroupId && dateStr && (
            <Link
              href={`/telegram/search?group_booking_id=${bookedGroupId}&date=${selectedDate?.toISOString().slice(0, 10) ?? ''}`}
              className="flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-[15px] font-semibold"
              style={{ background: T.accent, color: '#fff' }}
              onClick={() => haptic('medium')}
            >
              {t.addAnotherMaster}
            </Link>
          )}
          {isTelegram() && selectedDate && selectedTime && (
            <div className="flex w-full gap-2">
              <button
                onClick={addToGoogleCalendar}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold"
                style={{ background: T.surfaceElevated, color: T.text, border: `1px solid ${T.borderSubtle}` }}
              >
                <CalendarPlus className="size-4" style={{ color: T.accent }} />
                {t.addToCalendar}
              </button>
              <button
                onClick={shareBookingToTG}
                className="flex items-center justify-center rounded-2xl px-4 py-3.5 text-[15px] font-semibold"
                style={{ background: T.surfaceElevated, color: T.accent, border: `1px solid ${T.accent}33` }}
                aria-label={t.shareBooking}
              >
                <Share2 className="size-4" />
              </button>
            </div>
          )}
          <Link
            href="/telegram/activity"
            className="flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-[15px] font-semibold"
            style={{ background: T.surfaceElevated, color: T.text, border: `1px solid ${T.borderSubtle}` }}
            onClick={() => haptic('light')}
          >
            {t.viewBookings}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-full flex-col" style={{ background: T.bg, color: T.text }}>
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-30 px-4 pb-3 pt-4"
          style={{ background: T.surface, borderBottom: `1px solid ${T.borderSubtle}` }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              className="flex size-9 items-center justify-center rounded-full transition-colors"
              style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}
            >
              <ArrowLeft className="size-4" style={{ color: T.text }} />
            </button>

            <h1 className="text-[15px] font-semibold" style={{ color: T.text }}>
              {step === 'services' && t.stepServices}
              {step === 'datetime' && t.stepDatetime}
              {step === 'confirm' && t.stepConfirm}
            </h1>

            <button
              onClick={handleClose}
              className="flex size-9 items-center justify-center rounded-full transition-colors"
              style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}
            >
              <X className="size-4" style={{ color: T.text }} />
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
                  backgroundColor: i <= stepIndex ? VIOLET : T.borderSubtle,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Step Content ── */}
        <div className="relative flex-1">
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
                      className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                      style={{
                        background: !activeCategory ? T.text : T.surface,
                        color: !activeCategory ? T.surface : T.textSecondary,
                        border: `1px solid ${T.borderSubtle}`,
                      }}
                    >
                      {t.all}
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { haptic('light'); setActiveCategory(cat.id); }}
                        className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                        style={{
                          background: activeCategory === cat.id ? T.text : T.surface,
                          color: activeCategory === cat.id ? T.surface : T.textSecondary,
                          border: `1px solid ${T.borderSubtle}`,
                        }}
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
                        className="group relative flex w-full items-start gap-3.5 overflow-hidden rounded-2xl p-4 pl-5 text-left transition-colors"
                        style={{
                          background: T.surface,
                          border: `1px solid ${T.borderSubtle}`,
                        }}
                      >
                        {isSelected && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-violet-500" />}
                        {/* Checkmark circle */}
                        <div className="mt-0.5 shrink-0">
                          <motion.div
                            className="flex size-7 items-center justify-center rounded-full border-[1.5px] transition-colors"
                            style={{
                              borderColor: isSelected ? VIOLET : T.borderSubtle,
                              background: isSelected ? VIOLET : 'transparent',
                            }}
                            animate={{ scale: isSelected ? [1, 1.15, 1] : 1 }}
                            transition={{ duration: 0.25 }}
                          >
                            {isSelected ? (
                              <Check className="size-3.5" style={{ color: T.surface }} strokeWidth={3} />
                            ) : (
                              <Plus className="size-3.5" style={{ color: T.textTertiary }} strokeWidth={2} />
                            )}
                          </motion.div>
                        </div>

                        {/* Service info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold leading-tight" style={{ color: T.text }}>
                            {service.name}
                          </p>
                          {service.description && (
                            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed" style={{ color: T.textSecondary }}>
                              {service.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: T.textSecondary }}>
                            <Clock className="size-3.5" />
                            <span>{formatDuration(service.duration_minutes)}</span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="shrink-0 pt-0.5">
                          <p className="text-[14px] font-bold" style={{ color: T.text }}>
                            {formatMoney(service.price, service.currency)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Upsell suggestions */}
                {upsellSuggestions.length > 0 && selectedServices.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 rounded-2xl p-3"
                    style={{ background: T.surfaceElevated, border: `1px solid ${T.borderSubtle}` }}
                  >
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textTertiary }}>
                      {t.upsellLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {upsellSuggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { haptic('light'); toggleService(s); setUpsellSuggestions((prev) => prev.filter((u) => u.id !== s.id)); }}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
                          style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.accent}20` }}
                        >
                          <Plus className="size-3" strokeWidth={2.5} />
                          {s.name} · {formatMoney(s.price, s.currency)}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {services.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="mb-3 size-8" style={{ color: T.textTertiary }} />
                    <p className="text-sm" style={{ color: T.textSecondary }}>{t.noActiveServices}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 2: Date ═══ */}
            {step === 'datetime' && (
              <motion.div
                key="datetime"
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
                  <h2 className="text-[15px] font-semibold" style={{ color: T.text }}>
                    {/* capitalize-first вручную (CSS capitalize ставил «Р.» на «р.»). */}
                    {(() => {
                      const m = MONTH_NAMES_FULL[new Date().getMonth()];
                      return m.charAt(0).toUpperCase() + m.slice(1);
                    })()} {new Date().getFullYear()}
                  </h2>
                  <button
                    onClick={() => { haptic('light'); setShowFullCalendar(!showFullCalendar); }}
                    className="flex size-9 items-center justify-center rounded-full transition-colors"
                    style={{
                      border: `1px solid ${T.borderSubtle}`,
                      background: T.surface,
                      color: showFullCalendar ? VIOLET : T.textSecondary,
                    }}
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
                          // void для подавления unused warning — isToday раньше использовался,
                          // оставляем переменную если понадобится подсветка «сегодня».
                          void (date.toDateString() === new Date().toDateString());
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
                              className="flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2.5 transition-colors"
                              style={{
                                minWidth: 56,
                                background: isSelected ? VIOLET : off ? T.bgSubtle : T.surface,
                                border: `1px solid ${isSelected ? VIOLET : T.borderSubtle}`,
                                opacity: off ? 0.55 : 1,
                                cursor: off ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <span
                                className="text-[11px] font-medium"
                                style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : T.textTertiary }}
                              >
                                {dayName}
                              </span>
                              <span
                                className="text-[18px] font-bold leading-none"
                                style={{
                                  color: isSelected ? '#fff' : off ? T.textTertiary : T.text,
                                  textDecoration: off ? 'line-through' : 'none',
                                }}
                              >
                                {date.getDate()}
                              </span>
                              {off && (
                                <span
                                  className="text-[9px] font-semibold uppercase tracking-wide"
                                  style={{ color: T.textTertiary }}
                                >
                                  {t.dayOff}
                                </span>
                              )}
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
                          className="flex size-8 items-center justify-center rounded-lg transition-colors"
                          style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface, color: T.text }}
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <span className="text-[13px] font-semibold" style={{ color: T.text }}>
                          {(() => {
                            const m = MONTH_NAMES_FULL[calMonth.getMonth()];
                            return m.charAt(0).toUpperCase() + m.slice(1);
                          })()} {calMonth.getFullYear()}
                        </span>
                        <button
                          onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                          className="flex size-8 items-center justify-center rounded-lg transition-colors"
                          style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface, color: T.text }}
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>

                      {/* Day names */}
                      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium" style={{ color: T.textTertiary }}>
                        {CALENDAR_HEADER_BY_LANG[lang].map((d) => (
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
                              className="flex size-10 items-center justify-center rounded-xl text-[13px] font-medium transition-colors"
                              style={{
                                background: isSelected ? VIOLET : 'transparent',
                                color: isSelected ? '#fff' : off ? T.textDisabled : T.text,
                                border: isToday && !isSelected ? `1px solid ${T.border}` : 'none',
                                opacity: off ? 0.35 : 1,
                              }}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Time slots grid — shown immediately after date is picked */}
                {selectedDate && (
                  <motion.div
                    key={selectedDate.toDateString()}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <p className="text-[13px] font-medium capitalize" style={{ color: T.textSecondary }}>
                      {formatDateFull(selectedDate)}
                    </p>

                    {slotsLoading ? (
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: T.surface, border: `1px solid ${T.borderSubtle}` }} />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="space-y-2">
                        <div className="rounded-2xl p-6 text-center" style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
                          <CalendarIcon className="mx-auto mb-2 size-7" style={{ color: T.textDisabled }} />
                          <p className="text-[13px] font-medium" style={{ color: T.textSecondary }}>
                            {t.noFreeSlots}
                          </p>
                          {nextAvailableDate && (
                            <button
                              onClick={() => { haptic('light'); handleSelectDate(nextAvailableDate); }}
                              className="mt-3 rounded-xl px-4 py-2 text-[12px] font-semibold text-violet-600 transition-colors"
                              style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}
                            >
                              {t.nearest} {nextAvailableDate.getDate()} {MONTH_NAMES_GENITIVE[nextAvailableDate.getMonth()]}
                            </button>
                          )}
                        </div>
                        {waitlistJoined ? (
                          <div className="rounded-2xl px-4 py-3 text-center text-[13px] font-medium" style={{ background: T.accentSoft, color: T.accent }}>
                            {t.waitlistJoined}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleJoinWaitlist}
                            disabled={waitlistJoining}
                            className="w-full rounded-2xl px-4 py-3 text-[14px] font-semibold transition-opacity active:scale-[0.98]"
                            style={{
                              border: `1px solid ${T.border}`,
                              background: T.surface,
                              color: T.text,
                              opacity: waitlistJoining ? 0.6 : 1,
                            }}
                          >
                            {waitlistJoining ? '…' : t.joinWaitlist}
                          </button>
                        )}
                      </div>
                    ) : (
                      // Рендерим расписание дня как ряд блоков:
                      //  • зелёные «свободно» (карточка с timeframe + slot pills)
                      //  • серые «недоступно» (между занятыми/нерабочими промежутками)
                      // Шаг подстраивается под длительность услуги (см. /api/slots):
                      // 15 мин для услуг <60, 30 мин для <120, 60 мин для ≥120.
                      (() => {
                        const sorted = [...slots].sort((a, b) => a.localeCompare(b));
                        if (sorted.length === 0) return null;
                        const t2m = (t: string) => {
                          const [h, m] = t.split(':').map(Number);
                          return h * 60 + m;
                        };
                        const m2t = (mins: number) => {
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        };
                        const STEP = Math.max(15, totalDuration);

                        // Группируем continuous slots в окна (gap > step → разрыв).
                        const windows: string[][] = [];
                        let current: string[] = [sorted[0]];
                        for (let i = 1; i < sorted.length; i++) {
                          if (t2m(sorted[i]) - t2m(sorted[i - 1]) <= STEP) {
                            current.push(sorted[i]);
                          } else {
                            windows.push(current);
                            current = [sorted[i]];
                          }
                        }
                        windows.push(current);

                        // Собираем последовательность блоков: окно → пробел → окно → ...
                        type Block =
                          | { kind: 'free'; start: string; end: string; slots: string[] }
                          | { kind: 'busy'; start: string; end: string };
                        const blocks: Block[] = [];
                        for (let i = 0; i < windows.length; i++) {
                          const win = windows[i];
                          const winStart = win[0];
                          const winEndMin = t2m(win[win.length - 1]) + totalDuration;
                          const winEnd = m2t(winEndMin);
                          blocks.push({ kind: 'free', start: winStart, end: winEnd, slots: win });

                          // Если есть следующее окно — между ними серый промежуток.
                          if (i + 1 < windows.length) {
                            const nextStart = windows[i + 1][0];
                            blocks.push({ kind: 'busy', start: winEnd, end: nextStart });
                          }
                        }

                        return (
                          <div className="space-y-2">
                            {blocks.map((b, idx) => {
                              if (b.kind === 'busy') {
                                return (
                                  <div
                                    key={`busy-${idx}-${b.start}`}
                                    className="rounded-xl px-3 py-2.5 text-[12px] font-medium"
                                    style={{
                                      background: T.bgSubtle,
                                      color: T.textTertiary,
                                      border: `1px dashed ${T.borderSubtle}`,
                                    }}
                                  >
                                    {b.start} — {b.end} · {t.bookedSlot}
                                  </div>
                                );
                              }
                              return (
                                <motion.div
                                  key={`free-${idx}-${b.start}`}
                                  variants={fadeUp}
                                  initial="hidden"
                                  animate="visible"
                                  className="rounded-2xl p-3"
                                  style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}
                                >
                                  <div
                                    className="mb-2 px-1 text-[12px] font-semibold tracking-wide"
                                    style={{ color: T.textTertiary }}
                                  >
                                    {b.start} — {b.end}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {b.slots.map((time) => {
                                      const isSelected = selectedTime === time;
                                      return (
                                        <button
                                          key={time}
                                          onClick={() => handleSelectTime(time)}
                                          className="rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors active:scale-[0.97]"
                                          style={{
                                            border: `1px solid ${isSelected ? T.text : T.borderSubtle}`,
                                            background: isSelected ? T.text : 'transparent',
                                            color: isSelected ? T.bg : T.text,
                                            minWidth: 64,
                                          }}
                                        >
                                          {time}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                    {/* Только прошедшие слоты — показываем подсказку выбрать другой день */}
                    {!slotsLoading && slots.length === 0 && pastSlots.length > 0 && (
                      <div className="mt-2 rounded-xl px-3 py-2 text-center text-[12px]" style={{ border: `1px solid ${T.borderSubtle}`, background: T.bgSubtle, color: T.textSecondary }}>
                        {t.pastSlotsHint}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 3: Confirmation ═══ */}
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
                  className="overflow-hidden rounded-2xl"
                  style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}
                >
                  {/* Master info */}
                  <div className="flex items-center gap-3.5 p-5">
                    <div
                      className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full"
                      style={{ border: `1px solid ${T.borderSubtle}`, background: T.bgSubtle }}
                    >
                      {master?.avatar_url ? (
                        <Image
                          src={master.avatar_url}
                          alt=""
                          width={48}
                          height={48}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-[16px] font-bold" style={{ color: T.text }}>
                          {masterName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold" style={{ color: T.text }}>{masterName}</p>
                      {master?.address && (
                        <div className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: T.textSecondary }}>
                          <MapPin className="size-3" />
                          <span className="truncate">{master.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mx-5 h-px" style={{ background: T.borderSubtle }} />

                  {/* Date & Time */}
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl" style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
                        <CalendarIcon className="size-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: T.textTertiary }}>
                          {t.dateLabel}
                        </p>
                        <p className="text-[14px] font-semibold capitalize" style={{ color: T.text }}>
                          {formatDateFull(selectedDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl" style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
                        <Clock className="size-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: T.textTertiary }}>
                          {t.timeLabel}
                        </p>
                        <p className="text-[14px] font-semibold" style={{ color: T.text }}>
                          {selectedTime}–{endTime}{' '}
                          <span className="font-normal" style={{ color: T.textSecondary }}>
                            ({t.duration} {formatDuration(totalDuration)})
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mx-5 h-px" style={{ background: T.borderSubtle }} />

                  {/* Services breakdown */}
                  <div className="space-y-3 p-5">
                    {selectedServices.map((service) => {
                      return (
                        <div key={service.id} className="flex items-start justify-between gap-3">
                          <p className="min-w-0 flex-1 text-[14px] font-semibold" style={{ color: T.text }}>
                            {service.name}
                          </p>
                          <p className="shrink-0 text-[14px] font-bold" style={{ color: T.text }}>
                            {formatMoney(service.price, service.currency)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mx-5 h-px" style={{ background: T.borderSubtle }} />

                  {/* Total */}
                  <div className="flex items-center justify-between p-5">
                    <p className="text-[14px] font-medium" style={{ color: T.textSecondary }}>{t.totalToPay}</p>
                    <div className="text-right">
                      {giftCertDiscount != null && (
                        <p className="text-[13px] line-through" style={{ color: T.textSecondary }}>
                          {formatMoney(totalPrice, currency)}
                        </p>
                      )}
                      <p className="text-[20px] font-bold" style={{ color: T.text }}>
                        {formatMoney(Math.max(0, totalPrice - (giftCertDiscount ?? 0)), currency)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Gift certificate input */}
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className="mt-4 overflow-hidden rounded-2xl"
                  style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface }}
                >
                  {giftCertDiscount == null ? (
                    <div className="flex items-center gap-2 p-4">
                      <input
                        type="text"
                        value={giftCertCode}
                        onChange={(e) => { setGiftCertCode(e.target.value.toUpperCase()); setGiftCertError(''); }}
                        placeholder={t.giftCertPlaceholder}
                        maxLength={32}
                        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                        style={{ color: T.text }}
                      />
                      <button
                        onClick={handleApplyGiftCert}
                        disabled={!giftCertCode.trim() || giftCertCheckingState}
                        className="shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40"
                        style={{ background: T.text, color: T.bg }}
                      >
                        {giftCertCheckingState ? t.giftCertChecking : t.giftCertApply}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4">
                      <p className="text-[14px] font-semibold" style={{ color: T.accent }}>
                        {t.giftCertApplied(formatMoney(giftCertDiscount, currency))}
                      </p>
                      <button
                        onClick={() => { haptic('light'); setGiftCertDiscount(null); setGiftCertCode(''); }}
                        className="text-[13px] font-medium"
                        style={{ color: T.textSecondary }}
                      >
                        {t.giftCertRemove}
                      </button>
                    </div>
                  )}
                  {giftCertError && (
                    <p className="px-4 pb-3 text-[12px]" style={{ color: T.danger }}>{giftCertError}</p>
                  )}
                </motion.div>

                {master?.booking_important_info && master.booking_important_info.trim().length > 0 && (
                  <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="mt-4 overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-400/[0.06]"
                  >
                    <div className="flex items-start gap-3 p-5">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-600">
                        <Info className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold" style={{ color: T.text }}>{t.importantInfo}</p>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: T.textSecondary }}>
                          {master.booking_important_info}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
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
              className="fixed inset-x-0 bottom-0 z-40 px-4 pb-8 pt-4"
              style={{ borderTop: `1px solid ${T.borderSubtle}`, background: T.surface }}
            >
              {selectedServices.length > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 text-center text-[13px]"
                  style={{ color: T.textSecondary }}
                >
                  {formatMoney(totalPrice, currency)} · {selectedServices.length}{' '}
                  {pluralServices(selectedServices.length)} · {formatDuration(totalDuration)}
                </motion.p>
              )}
              <button
                onClick={proceedFromServices}
                disabled={selectedServices.length === 0}
                className="flex w-full items-center justify-center rounded-2xl py-4 text-[15px] font-semibold transition-colors"
                style={{
                  background: selectedServices.length > 0 ? T.text : T.bgSubtle,
                  color: selectedServices.length > 0 ? T.surface : T.textDisabled,
                }}
              >
                {t.continue}
              </button>
            </motion.div>
          )}

          {step === 'confirm' && !isTelegram() && (
            <motion.div
              key="footer-confirm"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 z-40 px-4 pb-8 pt-4"
              style={{ borderTop: `1px solid ${T.borderSubtle}`, background: T.surface }}
            >
              {/* In Telegram, the native MainButton is used instead. */}
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-semibold transition-colors disabled:opacity-60"
                style={{ background: T.text, color: T.surface }}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" strokeWidth={2.5} />
                )}
                {submitting ? t.booking : t.confirm}
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
              className="fixed inset-0 z-50 bg-neutral-900/70"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl px-5 pb-10 pt-6"
              style={{ borderTop: `1px solid ${T.borderSubtle}`, background: T.surface }}
            >
              {/* Handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: T.borderSubtle }} />

              <h3 className="text-center text-[17px] font-bold" style={{ color: T.text }}>
                {t.exitTitle}
              </h3>
              <p className="mt-2 text-center text-[14px]" style={{ color: T.textSecondary }}>
                {t.exitDesc}
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { haptic('light'); setShowExitModal(false); }}
                  className="flex-1 rounded-2xl py-3.5 text-[14px] font-semibold transition-colors"
                  style={{ border: `1px solid ${T.borderSubtle}`, background: T.surface, color: T.textSecondary }}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={confirmExit}
                  className="flex-1 rounded-2xl py-3.5 text-[14px] font-semibold transition-colors"
                  style={{ background: T.text, color: T.surface }}
                >
                  {t.exit}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
