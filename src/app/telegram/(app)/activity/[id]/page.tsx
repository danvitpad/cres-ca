/** --- YAML
 * name: MiniAppAppointmentDetail
 * description: Mini App — appointment detail. OD booking-detail visual: gradient banner, detail rows, 2×2 action grid. Cancel / reschedule / rate actions.
 * created: 2026-04-13
 * updated: 2026-05-14
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  CalendarDays,
  User,
  MapPin,
  Banknote,
  Phone,
  MessageCircle,
  RefreshCw,
  Star,
  AlertTriangle,
  Loader2,
  X,
  Share2,
  CalendarPlus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { formatMoney } from '@/lib/format/money';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { MobilePage } from '@/components/miniapp/shells';
import { MiniAppPortal } from '@/components/miniapp/portal';
import '@/styles/od-client-mini-app.css';

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

const I18N: Record<MiniAppLang, {
  back: string;
  notFound: string;
  service: string; date: string; total: string; place: string;
  masterLabel: string;
  numberCopied: (n: string) => string;
  noteLabel: string;
  rateMaster: string; repeat: string; reschedule: string; cancelBtn: string;
  cancelTitle: string; cancelHint: string;
  feeFree: string; feePartial: (s: string) => string; feeFull: (s: string) => string;
  cancelConfirmBack: string; cancelConfirm: string;
  rateTitle: string; ratePlaceholder: string; submitReview: string;
  share: string;
  shareText: (service: string, master: string, date: string) => string;
  addToCalendar: string;
  status: Record<string, string>;
  dateLocale: 'uk-UA' | 'ru-RU' | 'en-GB';
}> = {
  uk: {
    back: 'Назад', notFound: 'Запис не знайдено',
    service: 'Послуга', date: 'Дата та час', total: 'Оплата', place: 'Місце', masterLabel: 'Майстер',
    numberCopied: (n) => `Номер скопійовано: ${n}`,
    noteLabel: 'Нотатка',
    rateMaster: 'Оцінити майстра', repeat: 'Повторити запис', reschedule: 'Перенести', cancelBtn: 'Скасувати',
    cancelTitle: 'Скасувати запис?', cancelHint: 'Майстер отримає сповіщення про скасування',
    feeFree: 'Скасування безкоштовне', feePartial: (s) => `Часткова оплата: ${s}`, feeFull: (s) => `Повна вартість: ${s}`,
    cancelConfirmBack: 'Назад', cancelConfirm: 'Скасувати',
    rateTitle: 'Оцініть візит', ratePlaceholder: "Розкажіть про візит (необов'язково)", submitReview: 'Відправити відгук',
    share: 'Поділитись', shareText: (s, m, d) => `Записався до ${m} на ${s} — ${d}`,
    addToCalendar: 'До календаря',
    status: { booked: 'Майбутній', confirmed: 'Підтверджено', in_progress: 'Йде', completed: 'Виконано', cancelled: 'Скасовано', cancelled_by_client: 'Скасовано', no_show: 'Не прийшов' },
    dateLocale: 'uk-UA',
  },
  ru: {
    back: 'Назад', notFound: 'Запись не найдена',
    service: 'Услуга', date: 'Дата и время', total: 'Оплата', place: 'Место', masterLabel: 'Мастер',
    numberCopied: (n) => `Номер скопирован: ${n}`,
    noteLabel: 'Заметка',
    rateMaster: 'Оценить мастера', repeat: 'Повторить запись', reschedule: 'Перенести', cancelBtn: 'Отменить',
    cancelTitle: 'Отменить запись?', cancelHint: 'Мастер получит уведомление об отмене',
    feeFree: 'Отмена бесплатна', feePartial: (s) => `Частичная оплата: ${s}`, feeFull: (s) => `Полная стоимость: ${s}`,
    cancelConfirmBack: 'Назад', cancelConfirm: 'Отменить',
    rateTitle: 'Оцените визит', ratePlaceholder: 'Расскажите о визите (необязательно)', submitReview: 'Отправить отзыв',
    share: 'Поделиться', shareText: (s, m, d) => `Записался к ${m} на ${s} — ${d}`,
    addToCalendar: 'В календарь',
    status: { booked: 'Предстоит', confirmed: 'Подтверждено', in_progress: 'Идёт', completed: 'Завершено', cancelled: 'Отменено', cancelled_by_client: 'Отменено', no_show: 'Не пришёл' },
    dateLocale: 'ru-RU',
  },
  en: {
    back: 'Back', notFound: 'Booking not found',
    service: 'Service', date: 'Date & time', total: 'Payment', place: 'Place', masterLabel: 'Master',
    numberCopied: (n) => `Number copied: ${n}`,
    noteLabel: 'Note',
    rateMaster: 'Rate the master', repeat: 'Book again', reschedule: 'Reschedule', cancelBtn: 'Cancel',
    cancelTitle: 'Cancel this booking?', cancelHint: 'Master will be notified about the cancellation',
    feeFree: 'Cancellation is free', feePartial: (s) => `Partial fee: ${s}`, feeFull: (s) => `Full price: ${s}`,
    cancelConfirmBack: 'Back', cancelConfirm: 'Cancel',
    rateTitle: 'Rate the visit', ratePlaceholder: 'Tell us about the visit (optional)', submitReview: 'Send review',
    share: 'Share', shareText: (s, m, d) => `Booked ${s} with ${m} — ${d}`,
    addToCalendar: 'Add to Calendar',
    status: { booked: 'Upcoming', confirmed: 'Confirmed', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', cancelled_by_client: 'Cancelled', no_show: 'No-show' },
    dateLocale: 'en-GB',
  },
};

export default function MiniAppAppointmentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
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
      if (searchParams.get('review') === '1' && !json.reviewExists) {
        setRatingOpen(true);
      }
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
    toast(lang === 'en' ? 'Booking cancelled' : lang === 'ru' ? 'Запись отменена' : 'Запис скасовано');
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
    toast(lang === 'en' ? 'Thank you for the review!' : lang === 'ru' ? 'Спасибо за отзыв!' : 'Дякуємо за відгук!');
    setReviewExists(true);
    setRatingOpen(false);
  }

  function addToCalendar() {
    if (!row) return;
    haptic('light');
    const fmtGcal = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const starts = new Date(row.starts_at);
    const ends = new Date(row.ends_at);
    const masterName = row.master?.display_name ?? row.master?.profile?.full_name ?? '';
    const title = encodeURIComponent(`${row.service?.name ?? ''} (${masterName})`);
    const loc = encodeURIComponent([row.master?.address, row.master?.city].filter(Boolean).join(', '));
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmtGcal(starts)}/${fmtGcal(ends)}&location=${loc}`;
    try {
      (window as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } })
        .Telegram?.WebApp?.openLink?.(gcalUrl);
    } catch {}
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
      <MobilePage className="od-client-mini-app">
        <div style={{ padding: '60px 20px 52px', background: 'var(--accent-2)', margin: 0, height: 180 }} />
        <div style={{ height: 2 }} />
        <div style={{ padding: '4px 20px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 52, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--surface2)' }} />
              <div style={{ flex: 1, height: 20, background: 'var(--surface2)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </MobilePage>
    );
  }

  if (notFound || !row) {
    return (
      <MobilePage className="od-client-mini-app">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '0 32px', textAlign: 'center' }}>
          <AlertTriangle style={{ width: 48, height: 48, color: 'var(--fg-3)', marginBottom: 16 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>{t.notFound}</p>
          <button
            onClick={() => { haptic('selection'); router.push('/telegram/activity'); }}
            style={{ marginTop: 24, padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 14, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}
          >
            {t.back}
          </button>
        </div>
      </MobilePage>
    );
  }

  const masterName = row.master?.display_name || row.master?.profile?.full_name || '—';
  const masterInitials = masterName.split(' ').map((w: string) => w[0]).join('').toUpperCase();
  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);
  const durationMins = Math.round((ends.getTime() - starts.getTime()) / 60000);
  const dateStr = starts.toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'short' });
  const timeStr = starts.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' });
  const address = [row.master?.address, row.master?.city].filter(Boolean).join(', ') || '—';

  const canCancel =
    row.status !== 'cancelled' &&
    row.status !== 'cancelled_by_client' &&
    row.status !== 'completed' &&
    row.status !== 'no_show';
  const canReschedule = canCancel;
  const isCompleted = row.status === 'completed';
  const statusLabel = t.status[row.status] ?? t.status.booked;
  const statusBg = canCancel
    ? 'rgba(255,255,255,.22)'
    : isCompleted
      ? 'rgba(16,185,129,.3)'
      : 'rgba(255,255,255,.15)';

  function DetailRow({ icon, label, val }: { icon: React.ReactNode; label: string; val: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)' }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)', marginTop: 1 }}>{val}</div>
        </div>
      </div>
    );
  }

  const iconSz = { width: 16, height: 16 } as const;

  return (
    <MobilePage className="od-client-mini-app">
      {/* Banner */}
      <div style={{ background: 'linear-gradient(160deg,var(--accent) 0%,var(--a-600) 100%)', padding: '20px 20px 52px', position: 'relative', textAlign: 'center' }}>
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
        <div className="avatar av-lg" style={{ margin: '0 auto 12px', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 20 }}>
          {masterInitials}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{row.service?.name ?? '—'}</div>
        <div style={{ marginTop: 8, display: 'inline-block', background: statusBg, border: '1px solid rgba(255,255,255,.25)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
          {statusLabel}
        </div>
      </div>

      {/* Detail rows */}
      <div style={{ padding: '4px 20px 0' }}>
        <DetailRow icon={<Tag style={iconSz} />} label={t.service} val={`${row.service?.name ?? '—'} · ${durationMins} хв`} />
        <DetailRow icon={<CalendarDays style={iconSz} />} label={t.date} val={`${dateStr} · ${timeStr}`} />
        <DetailRow icon={<User style={iconSz} />} label={t.masterLabel} val={masterName} />
        <DetailRow icon={<MapPin style={iconSz} />} label={t.place} val={address} />
        <DetailRow icon={<Banknote style={iconSz} />} label={t.total} val={formatMoney(row.price, row.currency)} />
      </div>

      {/* Notes */}
      {row.notes && (
        <div style={{ margin: '0 20px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius-md)', marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{t.noteLabel}</div>
          <div style={{ fontSize: 14, color: 'var(--fg-2)' }}>{row.notes}</div>
        </div>
      )}

      {/* Before/After photos */}
      {beforeAfterPhotos.length > 0 && (
        <div style={{ margin: '10px 20px 0' }}>
          {beforeAfterPhotos.map((photo) => (
            <div key={photo.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ position: 'relative', aspectRatio: '3/4', background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 1, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,.5)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>До</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.before_url} alt="До" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ position: 'relative', aspectRatio: '3/4', background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 1, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,.5)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>Після</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.after_url} alt="Після" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
              {photo.caption && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{photo.caption}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '14px 20px 24px', borderTop: '1px solid var(--border)', marginTop: 12 }}>
        {canCancel ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => {
                haptic('light');
                if (row.master?.profile?.phone) {
                  navigator.clipboard.writeText(row.master.profile.phone)
                    .then(() => toast(t.numberCopied(row.master!.profile!.phone!)))
                    .catch(() => toast(row.master!.profile!.phone!));
                }
              }}
              style={{ height: 58, borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--fg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}
            >
              <Phone style={{ width: 18, height: 18, color: 'var(--accent)' }} />
              {lang === 'en' ? 'Call' : lang === 'ru' ? 'Позвонить' : 'Зателефонувати'}
            </button>
            <button
              onClick={() => { haptic('light'); toast(lang === 'en' ? 'Opening chat...' : lang === 'ru' ? 'Открываем чат...' : 'Відкриваємо чат...'); }}
              style={{ height: 58, borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--fg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}
            >
              <MessageCircle style={{ width: 18, height: 18, color: 'var(--accent)' }} />
              {lang === 'en' ? 'Message' : lang === 'ru' ? 'Написать' : 'Написати'}
            </button>
            {canReschedule && (
              <button
                onClick={() => { haptic('light'); router.push(`/telegram/book?master_id=${row.master_id}&service_id=${row.service_id}&reschedule=${row.id}`); }}
                style={{ height: 58, borderRadius: 'var(--radius-lg)', background: 'var(--surface2)', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--fg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}
              >
                <RefreshCw style={{ width: 18, height: 18, color: 'var(--accent)' }} />
                {t.reschedule}
              </button>
            )}
            <button
              onClick={() => { haptic('warning'); setCancelOpen(true); }}
              style={{ height: 58, borderRadius: 'var(--radius-lg)', background: '#fee2e2', border: 'none', fontSize: 12, fontWeight: 600, color: '#ef4444', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}
            >
              <X style={{ width: 18, height: 18, color: '#ef4444' }} />
              {t.cancelBtn}
            </button>
          </div>
        ) : isCompleted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!reviewExists && (
              <button
                className="btn btn-primary"
                onClick={() => { haptic('light'); setRatingOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Star style={{ width: 17, height: 17 }} /> {t.rateMaster}
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => { haptic('light'); router.push(`/telegram/book?master_id=${row.master_id}&service_id=${row.service_id}`); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <RefreshCw style={{ width: 17, height: 17 }} /> {t.repeat}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => { haptic('selection'); router.back(); }}
          >
            {t.back}
          </button>
        )}

        {/* Secondary: share + calendar */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={shareBooking}
            style={{ flex: 1, height: 40, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-2)', fontFamily: 'inherit' }}
          >
            <Share2 style={{ width: 15, height: 15 }} /> {t.share}
          </button>
          <button
            onClick={addToCalendar}
            style={{ flex: 1, height: 40, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-2)', fontFamily: 'inherit' }}
          >
            <CalendarPlus style={{ width: 15, height: 15 }} /> {t.addToCalendar}
          </button>
        </div>
      </div>

      {/* Cancel sheet */}
      <AnimatePresence>
        {cancelOpen && (
          <MiniAppPortal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => !busy && setCancelOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: 24, paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>{t.cancelTitle}</div>
                  <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 4 }}>{t.cancelHint}</div>
                </div>
                <button onClick={() => setCancelOpen(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X style={{ width: 14, height: 14, color: 'var(--fg-2)' }} />
                </button>
              </div>
              {cancelCost && (
                <div style={{
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${cancelCost.kind === 'free' ? 'var(--success-soft,#d1fae5)' : cancelCost.kind === 'partial' ? '#fde68a' : '#fecaca'}`,
                  background: cancelCost.kind === 'free' ? 'var(--success-soft,#ecfdf5)' : cancelCost.kind === 'partial' ? '#fffbeb' : '#fef2f2',
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: cancelCost.kind === 'free' ? 'var(--success,#10b981)' : cancelCost.kind === 'partial' ? '#d97706' : '#ef4444',
                  marginBottom: 16,
                }}>
                  {cancelCost.kind === 'free' && t.feeFree}
                  {cancelCost.kind === 'partial' && t.feePartial(formatMoney(cancelCost.amount, row.currency))}
                  {cancelCost.kind === 'full' && t.feeFull(formatMoney(cancelCost.amount, row.currency))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCancelOpen(false)}
                  disabled={busy}
                  style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}
                >
                  {t.cancelConfirmBack}
                </button>
                <button
                  onClick={doCancel}
                  disabled={busy}
                  style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--radius-md)', border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {busy ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : t.cancelConfirm}
                </button>
              </div>
            </motion.div>
          </motion.div>
          </MiniAppPortal>
        )}
      </AnimatePresence>

      {/* Rating sheet */}
      <AnimatePresence>
        {ratingOpen && (
          <MiniAppPortal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => !busy && setRatingOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: 24, paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>{t.rateTitle}</div>
                  <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 4 }}>{row.service?.name} · {masterName}</div>
                </div>
                <button onClick={() => setRatingOpen(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X style={{ width: 14, height: 14, color: 'var(--fg-2)' }} />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 0 16px' }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <button
                      key={v}
                      onClick={() => { setRatingScore(v); haptic('selection'); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Star style={{ width: 36, height: 36, fill: v <= ratingScore ? '#f59e0b' : 'none', stroke: v <= ratingScore ? '#f59e0b' : 'var(--border)', transition: 'fill .15s' }} />
                    </button>
                  );
                })}
              </div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder={t.ratePlaceholder}
                rows={3}
                style={{ width: '100%', resize: 'none', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface2)', padding: '12px 14px', fontSize: 14, color: 'var(--fg)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <button
                onClick={submitRating}
                disabled={busy}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {busy ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : t.submitReview}
              </button>
            </motion.div>
          </motion.div>
          </MiniAppPortal>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <MiniAppPortal>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            style={{ position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}
          >
            {toastMsg}
          </motion.div>
          </MiniAppPortal>
        )}
      </AnimatePresence>
    </MobilePage>
  );
}
