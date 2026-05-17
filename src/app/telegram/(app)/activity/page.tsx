/** --- YAML
 * name: MiniAppActivityPage
 * description: «Мої записи» Mini App — визуал из mobile-client/appointments мокапа.
 *              3 segment tabs (Майбутні / Минулі / Скасов.) с count'ами. Каждая
 *              запись: date-block (ДД/МІС), сервис, мастер, meta (час+ціна),
 *              status-chip + кнопки действий (Деталі/Перенести/Оцінити/Повторити).
 * created: 2026-04-13
 * updated: 2026-05-17
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock, Coins, Zap, Star, Repeat, RotateCcw, XCircle, X, Check, CalendarDays,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-mini-app.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage } from '@/components/miniapp/shells';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';
type Tab = 'future' | 'past' | 'cancel';

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  price: number | null;
  currency: string | null;
  cancelled_at?: string | null;
  master_id: string | null;
  master_name: string;
  service_name: string;
  service_duration_min: number | null;
  has_review: boolean;
}

const STATUS_CANCELLED = ['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'];

const T_LABELS: Record<Lang, {
  title: string;
  tabFuture: string; tabPast: string; tabCancel: string;
  empty: (tab: Tab) => string;
  findCta: string;
  chipToday: string; chipUpcoming: string;
  chipDone: string; chipReview: string; chipCancelled: string;
  details: string; reschedule: string; cancel: string;
  rate: string; repeat: string; bookAgain: string;
  cancelledOn: string;
  withMaster: string;
  min: string;
  monthsShort: string[];
}> = {
  uk: {
    title: 'Мої записи',
    tabFuture: 'Майбутні', tabPast: 'Минулі', tabCancel: 'Скасов.',
    empty: (t) => t === 'future' ? 'Немає майбутніх записів' : t === 'past' ? 'Історія порожня' : 'Скасованих немає',
    findCta: 'Знайти майстра',
    chipToday: 'Сьогодні', chipUpcoming: 'Майбутній',
    chipDone: 'Виконано', chipReview: 'Залиш відгук', chipCancelled: 'Скасовано',
    details: 'Деталі', reschedule: 'Перенести', cancel: 'Скасувати',
    rate: 'Оцінити', repeat: 'Повторити', bookAgain: 'Записатись знову',
    cancelledOn: 'Скасовано',
    withMaster: 'з',
    min: 'хв',
    monthsShort: ['СІЧ', 'ЛЮТ', 'БЕР', 'КВІ', 'ТРА', 'ЧЕР', 'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ'],
  },
  ru: {
    title: 'Мои записи',
    tabFuture: 'Будущие', tabPast: 'Прошлые', tabCancel: 'Отмен.',
    empty: (t) => t === 'future' ? 'Нет будущих записей' : t === 'past' ? 'История пуста' : 'Отменённых нет',
    findCta: 'Найти мастера',
    chipToday: 'Сегодня', chipUpcoming: 'Будущий',
    chipDone: 'Выполнено', chipReview: 'Оставь отзыв', chipCancelled: 'Отменено',
    details: 'Детали', reschedule: 'Перенести', cancel: 'Отменить',
    rate: 'Оценить', repeat: 'Повторить', bookAgain: 'Записаться снова',
    cancelledOn: 'Отменено',
    withMaster: 'у',
    min: 'мин',
    monthsShort: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
  },
  en: {
    title: 'My appointments',
    tabFuture: 'Upcoming', tabPast: 'Past', tabCancel: 'Cancelled',
    empty: (t) => t === 'future' ? 'No upcoming' : t === 'past' ? 'No history' : 'Nothing cancelled',
    findCta: 'Find a master',
    chipToday: 'Today', chipUpcoming: 'Upcoming',
    chipDone: 'Done', chipReview: 'Leave review', chipCancelled: 'Cancelled',
    details: 'Details', reschedule: 'Reschedule', cancel: 'Cancel',
    rate: 'Rate', repeat: 'Repeat', bookAgain: 'Book again',
    cancelledOn: 'Cancelled',
    withMaster: 'with',
    min: 'min',
    monthsShort: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  },
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MiniAppActivityPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('future');

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
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
        } catch {}
        return null;
      })();
      if (!initData) { setLoading(false); return; }

      try {
        const res = await fetch('/api/telegram/c/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (!res.ok) { setLoading(false); return; }
        const json = await res.json();
        if (cancelled) return;

        type SalonEmbed = { id: string; name: string | null; logo_url: string | null; city: string | null };
        type MasterEmbed = {
          id: string | null;
          display_name: string | null;
          avatar_url: string | null;
          specialization: string | null;
          salon_id: string | null;
          profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
          salon: SalonEmbed | SalonEmbed[] | null;
        };

        const list = (json.appointments ?? []).map((raw: unknown) => {
          const a = raw as {
            id: string;
            starts_at: string;
            ends_at: string | null;
            status: string;
            price: number | null;
            currency: string | null;
            cancelled_at?: string | null;
            master: MasterEmbed | null;
            service: { name: string | null; duration_minutes?: number | null } | { name: string | null; duration_minutes?: number | null }[] | null;
            reviewExists?: boolean;
          };
          const master = Array.isArray(a.master) ? a.master[0] : a.master;
          const masterProfile = master ? (Array.isArray(master.profile) ? master.profile[0] : master.profile) : null;
          const service = Array.isArray(a.service) ? a.service[0] : a.service;
          const dur = service?.duration_minutes ?? (a.ends_at && a.starts_at
            ? Math.max(0, Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000))
            : null);
          return {
            id: a.id,
            starts_at: a.starts_at,
            ends_at: a.ends_at,
            status: a.status,
            price: a.price,
            currency: a.currency,
            cancelled_at: a.cancelled_at ?? null,
            master_id: master?.id ?? null,
            master_name: master?.display_name ?? masterProfile?.full_name ?? '—',
            service_name: service?.name ?? '—',
            service_duration_min: dur,
            has_review: !!a.reviewExists,
          } satisfies AppointmentRow;
        });
        setRows(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const groups = useMemo(() => {
    const future: AppointmentRow[] = [];
    const past: AppointmentRow[] = [];
    const cancel: AppointmentRow[] = [];
    const now = Date.now();
    for (const a of rows) {
      if (STATUS_CANCELLED.includes(a.status)) {
        cancel.push(a);
      } else if (a.status === 'completed' || new Date(a.starts_at).getTime() < now - 60_000) {
        past.push(a);
      } else {
        future.push(a);
      }
    }
    future.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    past.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    cancel.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { future, past, cancel };
  }, [rows]);

  const displayed = groups[tab];

  return (
    <MobilePage className="od-client-mini-app">
      {/* Top bar */}
      <div className="mc-top">
        <div>
          <div className="mc-top-title">{t.title}</div>
        </div>
      </div>

      {/* Segment tabs */}
      <div className="mc-seg">
        {([
          ['future', t.tabFuture, groups.future.length],
          ['past', t.tabPast, groups.past.length],
          ['cancel', t.tabCancel, groups.cancel.length],
        ] as const).map(([k, label, count]) => (
          <button
            key={k}
            className={`mc-seg-b ${tab === k ? 'active' : ''}`}
            onClick={() => { setTab(k as Tab); haptic('selection'); }}
          >
            {label}
            <span className="c">{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mc-loading"><CalendarDays size={24} /></div>
      ) : displayed.length === 0 ? (
        <div className="mc-empty">
          <CalendarDays size={36} strokeWidth={1.5} />
          <p className="mc-empty-t">{t.empty(tab)}</p>
          <Link
            href="/telegram/search"
            onClick={() => haptic('light')}
            className="mc-result-cta"
            style={{ marginTop: 12, padding: '8px 16px' }}
          >
            {t.findCta}
          </Link>
        </div>
      ) : (
        <div className="mc-apl">
          {displayed.map((a) => (
            <ApptCard key={a.id} row={a} t={t} lang={lang} onClick={() => { haptic('light'); router.push(`/telegram/activity/${a.id}`); }} onRepeat={() => { haptic('light'); router.push(`/telegram/book?master_id=${a.master_id ?? ''}`); }} />
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
    </MobilePage>
  );
}

function ApptCard({
  row, t, lang, onClick, onRepeat,
}: {
  row: AppointmentRow;
  t: typeof T_LABELS[Lang];
  lang: Lang;
  onClick: () => void;
  onRepeat: () => void;
}) {
  const start = new Date(row.starts_at);
  const day = start.getDate().toString().padStart(2, '0');
  const monShort = t.monthsShort[start.getMonth()];
  const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;

  const isCancelled = STATUS_CANCELLED.includes(row.status);
  const isCompleted = row.status === 'completed';
  const isPast = isCancelled || isCompleted || start.getTime() < Date.now() - 60_000;
  const isToday = isSameDay(start, new Date());
  const canRate = isCompleted && !row.has_review;

  return (
    <div className="mc-ap" onClick={onClick} role="button" tabIndex={0}>
      <div className={`mc-ap-d ${isPast ? 'past' : ''}`}>
        <b>{day}</b>
        <span>{monShort}</span>
      </div>
      <div className="mc-ap-i">
        <div className="mc-ap-s">{row.service_name}</div>
        <div className="mc-ap-m">{t.withMaster} {row.master_name}</div>
        <div className="mc-ap-meta">
          {!isCancelled && (
            <span>
              <Clock />{timeStr}{row.service_duration_min ? ` · ${row.service_duration_min} ${t.min}` : ''}
            </span>
          )}
          {isCancelled && row.cancelled_at && (
            <span>
              <XCircle />{t.cancelledOn} · {formatShortDate(row.cancelled_at, lang)}
            </span>
          )}
          {row.price != null && (
            <span><Coins />₴{Math.round(row.price)}</span>
          )}
        </div>

        {/* Status chip */}
        {canRate ? (
          <span className="mc-ap-st review"><Star />{t.chipReview}</span>
        ) : isCompleted ? (
          <span className="mc-ap-st done">{t.chipDone}</span>
        ) : isCancelled ? (
          <span className="mc-ap-st cancel"><X />{t.chipCancelled}</span>
        ) : isToday ? (
          <span className="mc-ap-st up"><Zap />{t.chipToday}</span>
        ) : (
          <span className="mc-ap-st up">{t.chipUpcoming}</span>
        )}

        {/* Actions */}
        <div className="mc-ap-acts" onClick={(e) => e.stopPropagation()}>
          {isCancelled ? (
            <button className="mc-apa primary" onClick={onRepeat}>
              <Repeat />{t.bookAgain}
            </button>
          ) : isCompleted ? (
            <>
              {canRate && (
                <button className="mc-apa primary" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                  <Star />{t.rate}
                </button>
              )}
              <button className="mc-apa" onClick={onRepeat}>
                <Repeat />{t.repeat}
              </button>
            </>
          ) : (
            <>
              <button className="mc-apa" onClick={onClick}>{t.details}</button>
              <button className="mc-apa" onClick={onClick}>
                <RotateCcw />{t.reschedule}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatShortDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')} ${T_LABELS[lang].monthsShort[d.getMonth()].toLowerCase()}`;
}
