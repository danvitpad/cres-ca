/** --- YAML
 * name: MiniAppAppointmentDetail
 * description: Mini App — full appointment detail with cancel / reschedule / repeat / rate master actions. Dark theme, Telegram haptics.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  RefreshCw,
  Star,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Phone,
  CalendarClock,
  Loader2,
  X,
  Share2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { formatMoney } from '@/lib/format/money';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface DetailRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  currency: string;
  master_id: string;
  service_id: string;
  notes: string | null;
  service: { name: string; color: string | null; description: string | null } | null;
  master: {
    id: string;
    display_name: string | null;
    specialization: string | null;
    avatar_url: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    cancellation_policy: { free_hours?: number; partial_hours?: number; partial_percent?: number } | null;
    profile: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
  } | null;
}

const STATUS_COLOR: Record<string, string> = {
  booked: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-600 border-emerald-300',
  in_progress: 'bg-violet-100 text-violet-600 border-violet-300',
  completed: 'bg-emerald-500/15 text-emerald-600 border-emerald-300',
  cancelled: 'bg-rose-500/15 text-rose-600 border-rose-300',
  cancelled_by_client: 'bg-rose-500/15 text-rose-600 border-rose-300',
  no_show: 'bg-amber-500/15 text-amber-600 border-amber-300',
};

const I18N: Record<MiniAppLang, {
  back: string;
  notFound: string;
  service: string; date: string; time: string; total: string; place: string; route: string; copyNumber: string;
  numberCopied: (n: string) => string;
  noteLabel: string; beforeAfterLabel: string; before: string; after: string;
  rateMaster: string; repeat: string; reschedule: string; cancelBtn: string;
  cancelTitle: string; cancelHint: string;
  feeFree: string; feePartial: (s: string) => string; feeFull: (s: string) => string;
  cancelConfirmBack: string; cancelConfirm: string;
  rateTitle: string; ratePlaceholder: string; submitReview: string;
  share: string;
  shareText: (service: string, master: string, date: string) => string;
  status: Record<string, string>;
  dateLocale: 'uk-UA' | 'ru-RU' | 'en-GB';
}> = {
  uk: {
    back: 'Назад', notFound: 'Запис не знайдено',
    service: 'Послуга', date: 'Дата', time: 'Час', total: 'Разом', place: 'Місце', route: 'Маршрут', copyNumber: 'Скопіювати',
    numberCopied: (n) => `Номер скопійовано: ${n}`,
    noteLabel: 'Нотатка', beforeAfterLabel: 'До / Після', before: 'До', after: 'Після',
    rateMaster: 'Оцінити майстра', repeat: 'Повторити запис', reschedule: 'Перенести', cancelBtn: 'Скасувати запис',
    cancelTitle: 'Скасувати запис?', cancelHint: 'Майстер отримає сповіщення про скасування',
    feeFree: 'Скасування безкоштовне', feePartial: (s) => `Часткова оплата: ${s}`, feeFull: (s) => `Повна вартість: ${s}`,
    cancelConfirmBack: 'Назад', cancelConfirm: 'Скасувати',
    rateTitle: "Оцініть візит", ratePlaceholder: "Розкажи про візит (необов’язково)", submitReview: "Відправити відгук",
    share: "Поділитись", shareText: (s, m, d) => `Записався до ${m} на ${s} — ${d}`,
    status: { booked: "Записано", confirmed: "Підтверджено", in_progress: "Йде", completed: "Завершено", cancelled: "Скасовано", cancelled_by_client: "Скасовано", no_show: "Не прийшов" },
    dateLocale: 'uk-UA',
  },
  ru: {
    back: 'Назад', notFound: 'Запись не найдена',
    service: 'Услуга', date: 'Дата', time: 'Время', total: 'Итого', place: 'Место', route: 'Маршрут', copyNumber: 'Скопировать',
    numberCopied: (n) => `Номер скопирован: ${n}`,
    noteLabel: 'Заметка', beforeAfterLabel: 'До / После', before: 'До', after: 'После',
    rateMaster: 'Оценить мастера', repeat: 'Повторить запись', reschedule: 'Перенести', cancelBtn: 'Отменить запись',
    cancelTitle: 'Отменить запись?', cancelHint: 'Мастер получит уведомление об отмене',
    feeFree: 'Отмена бесплатна', feePartial: (s) => `Частичная оплата: ${s}`, feeFull: (s) => `Полная стоимость: ${s}`,
    cancelConfirmBack: 'Назад', cancelConfirm: 'Отменить',
    rateTitle: 'Оцените визит', ratePlaceholder: 'Расскажи о визите (необязательно)', submitReview: 'Отправить отзыв',
    share: 'Поделиться', shareText: (s, m, d) => `Записался к ${m} на ${s} — ${d}`,
    status: { booked: 'Записан', confirmed: 'Подтверждено', in_progress: 'Идёт', completed: 'Завершено', cancelled: 'Отменено', cancelled_by_client: 'Отменено', no_show: 'Не пришёл' },
    dateLocale: 'ru-RU',
  },
  en: {
    back: 'Back', notFound: 'Booking not found',
    service: 'Service', date: 'Date', time: 'Time', total: 'Total', place: 'Place', route: 'Directions', copyNumber: 'Copy',
    numberCopied: (n) => `Number copied: ${n}`,
    noteLabel: 'Note', beforeAfterLabel: 'Before / After', before: 'Before', after: 'After',
    rateMaster: 'Rate the master', repeat: 'Book again', reschedule: 'Reschedule', cancelBtn: 'Cancel booking',
    cancelTitle: 'Cancel this booking?', cancelHint: 'Master will be notified about the cancellation',
    feeFree: 'Cancellation is free', feePartial: (s) => `Partial fee: ${s}`, feeFull: (s) => `Full price: ${s}`,
    cancelConfirmBack: 'Back', cancelConfirm: 'Cancel',
    rateTitle: 'Rate the visit', ratePlaceholder: 'Tell us about the visit (optional)', submitReview: 'Send review',
    share: 'Share', shareText: (s, m, d) => `Booked ${s} with ${m} — ${d}`,
    status: { booked: 'Booked', confirmed: 'Confirmed', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', cancelled_by_client: 'Cancelled', no_show: 'No-show' },
    dateLocale: 'en-GB',
  },
};

export default function MiniAppAppointmentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewExists, setReviewExists] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [beforeAfterPhotos, setBeforeAfterPhotos] = useState<{ id: string; before_url: string; after_url: string; caption: string | null }[]>([]);

  useEffect(() => {
    if (!userId || !params?.id) return;
    (async () => {
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
      if (!initData) { setNotFound(true); setLoading(false); return; }

      const res = await fetch('/api/telegram/c/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, id: params.id }),
      });
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const json = await res.json();
      if (!json.appointment) { setNotFound(true); setLoading(false); return; }
      setRow(json.appointment as DetailRow);
      setReviewExists(!!json.reviewExists);
      setBeforeAfterPhotos((json.beforeAfterPhotos ?? []) as typeof beforeAfterPhotos);
      setLoading(false);
    })();
  }, [userId, params?.id]);

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

  const hoursUntilStart = useMemo(() => {
    if (!row) return Infinity;
    return (new Date(row.starts_at).getTime() - Date.now()) / 3_600_000;
  }, [row]);

  const cancelCost = useMemo(() => {
    if (!row || !row.master) return null;
    const policy = row.master.cancellation_policy ?? { free_hours: 24, partial_hours: 12, partial_percent: 50 };
    const freeH = policy.free_hours ?? 24;
    const partialH = policy.partial_hours ?? 12;
    const partialP = policy.partial_percent ?? 50;
    if (hoursUntilStart >= freeH) return { kind: 'free' as const, amount: 0 };
    if (hoursUntilStart >= partialH) {
      return { kind: 'partial' as const, amount: Math.round((Number(row.price) * partialP) / 100) };
    }
    return { kind: 'full' as const, amount: Number(row.price) };
  }, [row, hoursUntilStart]);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  async function doCancel() {
    if (!row || busy) return;
    setBusy(true);
    haptic('warning');
    const initData = getInitData();
    if (!initData) { setBusy(false); return; }
    const res = await fetch('/api/telegram/c/activity-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, action: 'cancel', appointment_id: row.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast('Ошибка: ' + (j.error ?? res.status));
      setBusy(false);
      return;
    }
    haptic('success');
    toast('Запись отменена');
    setRow({ ...row, status: 'cancelled_by_client' });
    setCancelOpen(false);
    setBusy(false);
  }

  async function submitRating() {
    if (!row || busy) return;
    setBusy(true);
    const initData = getInitData();
    if (!initData) { setBusy(false); return; }
    const res = await fetch('/api/telegram/c/activity-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        action: 'review',
        appointment_id: row.id,
        score: ratingScore,
        comment: ratingComment,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast('Ошибка: ' + (j.error ?? res.status));
      return;
    }
    haptic('success');
    toast('Спасибо за отзыв!');
    setReviewExists(true);
    setRatingOpen(false);
  }

  function shareBooking() {
    if (!row) return;
    haptic('light');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cres-ca.com';
    const bookUrl = `${appUrl}/telegram/book?master_id=${row.master_id}&service_id=${row.service_id}`;
    const dateStr = new Date(row.starts_at).toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'short' });
    const name = row.master?.display_name || row.master?.profile?.full_name || '';
    const text = t.shareText(row.service?.name ?? '', name, dateStr);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(bookUrl)}&text=${encodeURIComponent(text)}`;
    try {
      (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
        .Telegram?.WebApp?.openTelegramLink?.(shareUrl);
    } catch {}
  }

  if (loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <div className="h-8 w-32 animate-pulse rounded-full bg-white/5" />
        <div className="h-56 w-full animate-pulse rounded-3xl bg-white/5" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <AlertTriangle className="mb-4 size-12 text-neutral-400" />
        <p className="text-base font-semibold">{t.notFound}</p>
        <button
          onClick={() => { haptic('selection'); router.push('/telegram/activity'); }}
          className="mt-6 rounded-[var(--brand-radius-lg)] border border-neutral-200 px-4 py-2 text-sm"
          style={{ minHeight: 44 }}
        >
          {t.back}
        </button>
      </div>
    );
  }

  const masterName = row.master?.display_name || row.master?.profile?.full_name || '—';
  const masterAvatar = row.master?.avatar_url || row.master?.profile?.avatar_url || null;
  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);
  // Buttons stay visible for any non-terminal status. Past-time cancellation
  // policy/fees are explained in the cancel sheet (`cancelCost`); we don't
  // hide the controls just because the appointment is in the past — the user
  // still needs a way to formally cancel a no-show.
  const canCancel =
    row.status !== 'cancelled' &&
    row.status !== 'cancelled_by_client' &&
    row.status !== 'completed' &&
    row.status !== 'no_show';
  // Перенести показываем всегда вместе с «Отменить» — даже если запись в
  // прошлом, клиент может перенести её на будущую дату (это и есть запасной
  // вариант для no-show — не отмена с штрафом, а перенос).
  const canReschedule = canCancel;
  const isCompleted = row.status === 'completed';
  const statusLabel = t.status[row.status] ?? t.status.booked;
  const statusColor = STATUS_COLOR[row.status] ?? STATUS_COLOR.booked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-5 pt-5 pb-6"
    >
      <button
        onClick={() => {
          haptic('selection');
          router.back();
        }}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-600 active:text-neutral-900"
      >
        <ArrowLeft className="size-4" /> {t.back}
      </button>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-[28px] border border-neutral-200 bg-gradient-to-br from-white/10 to-white/5 p-5">
        <div
          className="absolute -right-20 -top-20 size-60 rounded-full opacity-30 blur-3xl"
          style={{ background: row.service?.color ?? '#2dd4bf' }}
        />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{t.service}</p>
              <h1 className="mt-1 text-xl font-bold">{row.service?.name ?? '—'}</h1>
              {row.service?.description && (
                <p className="mt-1 line-clamp-2 text-[12px] text-neutral-500">{row.service.description}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusColor}`}>
              {isCompleted && <CheckCircle2 className="mr-1 inline size-2.5" />}
              {statusLabel}
            </span>
          </div>

          <button
            onClick={() => { haptic('selection'); router.push(`/telegram/search/${row.master_id}`); }}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left active:scale-[0.98] transition-transform"
            style={{ minHeight: 56 }}
          >
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-sm font-bold">
              {masterAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={masterAvatar} alt="" className="size-full object-cover" />
              ) : (
                masterName.charAt(0)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{masterName}</p>
              {row.master?.specialization && (
                <p className="truncate text-[11px] text-neutral-500">{row.master.specialization}</p>
              )}
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-400">
                <CalendarDays className="size-3" /> Дата
              </p>
              <p className="mt-1 text-[13px] font-semibold">
                {starts.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-400">
                <Clock className="size-3" /> Время
              </p>
              <p className="mt-1 text-[13px] font-semibold">
                {starts.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} —{' '}
                {ends.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
            <span className="text-xs text-neutral-500">Итого</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatMoney(row.price, row.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Address */}
      {row.master?.address && (
        <div className="rounded-2xl border border-neutral-200 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <MapPin className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-neutral-400">Место</p>
              <p className="mt-0.5 text-sm font-semibold">{row.master.address}</p>
              {row.master.city && <p className="text-[11px] text-neutral-500">{row.master.city}</p>}
            </div>
            {row.master.latitude && row.master.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${row.master.latitude},${row.master.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold"
              >
                Маршрут
              </a>
            )}
          </div>
        </div>
      )}

      {/* Phone of the master — кнопка «Скопировать номер». tel:-навигация
          в Telegram WebView ненадёжна (несколько раз пробовали разные подходы,
          у юзера всё равно не открывался диалер), поэтому даём только копию
          номера и сам номер крупно — клиент копирует и набирает в нативном
          приложении телефона. */}
      {row.master?.profile?.phone && (
        <button
          type="button"
          onClick={async () => {
            const phone = row.master?.profile?.phone;
            if (!phone) return;
            haptic('light');
            try {
              await navigator.clipboard.writeText(phone);
              toast(`Номер скопирован: ${phone}`);
            } catch {
              toast(phone);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white/5 px-4 py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
          title="Скопировать номер"
        >
          <Phone className="size-4" /> {row.master.profile.phone} · Скопировать
        </button>
      )}

      {/* Notes */}
      {row.notes && (
        <div className="rounded-2xl border border-neutral-200 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400">Заметка</p>
          <p className="mt-1 text-sm">{row.notes}</p>
        </div>
      )}

      {/* Before/After photos */}
      {beforeAfterPhotos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">До / После</p>
          {beforeAfterPhotos.map((photo) => (
            <div key={photo.id} className="space-y-2">
              <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">
                <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
                  <p className="absolute left-2 top-2 z-10 rounded-full bg-neutral-900/60 px-2 py-0.5 text-[9px] font-semibold">До</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.before_url} alt="До" className="size-full object-cover" />
                </div>
                <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
                  <p className="absolute left-2 top-2 z-10 rounded-full bg-neutral-900/60 px-2 py-0.5 text-[9px] font-semibold">После</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.after_url} alt="После" className="size-full object-cover" />
                </div>
              </div>
              {photo.caption && (
                <p className="text-[12px] text-neutral-600">{photo.caption}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        {isCompleted && !reviewExists && (
          <button
            onClick={() => {
              haptic('light');
              setRatingOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform"
          >
            <Star className="size-5" /> Оценить мастера
          </button>
        )}
        {isCompleted && (
          <button
            onClick={() => { haptic('light'); router.push(`/telegram/book?master_id=${row.master_id}&service_id=${row.service_id}`); }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white/5 py-4 text-[15px] font-semibold active:scale-[0.98] transition-transform"
            style={{ minHeight: 44 }}
          >
            <RefreshCw className="size-5" /> Повторить запись
          </button>
        )}
        {canReschedule && (
          <button
            onClick={() => { haptic('light'); router.push(`/telegram/book?master_id=${row.master_id}&service_id=${row.service_id}&reschedule=${row.id}`); }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white/5 py-4 text-[15px] font-semibold active:scale-[0.98] transition-transform"
            style={{ minHeight: 44 }}
          >
            <CalendarClock className="size-5" /> Перенести
          </button>
        )}
        <button
          onClick={shareBooking}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white/5 py-4 text-[15px] font-semibold active:scale-[0.98] transition-transform"
          style={{ minHeight: 44 }}
        >
          <Share2 className="size-5" /> {t.share}
        </button>
        {canCancel && (
          <button
            onClick={() => {
              haptic('warning');
              setCancelOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 py-4 text-[15px] font-semibold text-rose-600 active:scale-[0.98] transition-transform"
          >
            <XCircle className="size-5" /> Отменить запись
          </button>
        )}
      </div>

      {/* Cancel sheet */}
      <AnimatePresence>
        {cancelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end bg-neutral-900/70 backdrop-blur-sm"
            onClick={() => !busy && setCancelOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full space-y-4 rounded-t-[32px] border-t border-neutral-200 bg-white p-6"
              // Padding снизу клирит floating bottom-nav (12px bottom + 64px высота
              // + safe-area). Иначе кнопки «Назад/Отменить» уезжают под nav.
              style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Отменить запись?</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Мастер получит уведомление об отмене
                  </p>
                </div>
                <button
                  onClick={() => setCancelOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>
              {cancelCost && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    cancelCost.kind === 'free'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : cancelCost.kind === 'partial'
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-rose-300 bg-rose-50 text-rose-700'
                  }`}
                >
                  {cancelCost.kind === 'free' && <p className="font-semibold">Отмена бесплатна</p>}
                  {cancelCost.kind === 'partial' && (
                    <p className="font-semibold">Частичная оплата: {formatMoney(cancelCost.amount, row.currency)}</p>
                  )}
                  {cancelCost.kind === 'full' && (
                    <p className="font-semibold">Полная стоимость: {formatMoney(cancelCost.amount, row.currency)}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setCancelOpen(false)}
                  disabled={busy}
                  className="flex-1 rounded-2xl border border-neutral-200 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  Назад
                </button>
                <button
                  onClick={doCancel}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-neutral-900 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : 'Отменить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating sheet */}
      <AnimatePresence>
        {ratingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end bg-neutral-900/70 backdrop-blur-sm"
            onClick={() => !busy && setRatingOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full space-y-4 rounded-t-[32px] border-t border-neutral-200 bg-white p-6"
              style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Оцените визит</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {row.service?.name} · {masterName}
                  </p>
                </div>
                <button
                  onClick={() => setRatingOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex justify-center gap-1 py-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setRatingScore(v);
                        haptic('selection');
                      }}
                      className="p-1"
                    >
                      <Star
                        className={`size-9 transition-colors ${
                          v <= ratingScore ? 'fill-amber-400 stroke-amber-400' : 'stroke-white/30'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Расскажи о визите (необязательно)"
                rows={3}
                className="w-full resize-none rounded-2xl border border-neutral-200 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300"
              />
              <button
                onClick={submitRating}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : 'Отправить отзыв'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-[var(--brand-radius-lg)] border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold shadow-2xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
