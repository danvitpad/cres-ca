/** --- YAML
 * name: MiniAppHomePage
 * description: «Для вас» — Open Design alignment. Header с user-аватаром справа,
 *              hero ближайшей записи с master-блоком + pills + Подробнее CTA,
 *              regular masters carousel + free slots list с явной кнопкой
 *              «Записаться →». Категории/AI-консьерж — на Tab «Найти».
 * created: 2026-04-13
 * updated: 2026-05-11
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-mini-app.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { formatMoney } from '@/lib/format/money';
import { MobilePage } from '@/components/miniapp/shells';
import { getCached, setCached } from '@/lib/miniapp/cache';
import { HomeScreenBanner } from '@/components/miniapp/home-screen-banner';

interface SalonRef {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
}
interface NextAppointment {
  id: string;
  starts_at: string;
  master_id: string | null;
  master_name: string;
  master_avatar: string | null;
  master_specialization: string | null;
  salon: SalonRef | null;
  service_name: string;
  price: number;
  currency: string | null;
}
interface SlotItem {
  masterId: string;
  name: string | null;
  avatar: string | null;
  date: string;
  time: string;
  iso: string;
}
type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  title: string;
  morningHi: string; dayHi: string; eveningHi: string; nightHi: string;
  upcoming: string; details: string;
  regulars: string; atMaster: string;
  freeSlots: string; allContacts: string;
  recommended: string; viewAll: string; from: string;
  explore: string; topCats: string;
  cat: { beauty: string; health: string; pets: string; fitness: string; auto: string; home: string };
  topcat: { hair: string; massage: string; trainer: string; grooming: string; repair: string };
  today: string; tomorrow: string;
  aiConcierge: string; minSuffix: string; masterFallback: string;
  bookCta: string;
  // Empty state — когда у клиента нет ни записей, ни постоянных, ни слотов.
  emptyTitle: string; emptyText: string; emptyCta: string;
}> = {
  uk: {
    title: 'Привіт',
    morningHi: 'Доброго ранку', dayHi: 'Доброго дня', eveningHi: 'Доброго вечора', nightHi: 'Доброї ночі',
    upcoming: 'Найближчий запис', details: 'Детальніше',
    regulars: 'Ваші постійні', atMaster: 'у',
    freeSlots: 'Вільні слоти ваших майстрів', allContacts: 'Мої майстри',
    recommended: 'Рекомендуємо', viewAll: 'Дивитися всі', from: 'від',
    explore: 'Категорії', topCats: 'Популярне',
    cat: { beauty: 'Краса', health: "Здоров'я", pets: 'Тварини', fitness: 'Фітнес', auto: 'Авто', home: 'Дім' },
    topcat: { hair: 'Стрижка та укладка', massage: 'Масаж', trainer: 'Тренер', grooming: 'Грумінг', repair: 'Ремонт' },
    today: 'Сьогодні', tomorrow: 'Завтра',
    aiConcierge: 'AI-консьєрж', minSuffix: 'хв', masterFallback: 'Майстер',
    bookCta: 'Записатися',
    emptyTitle: 'Поки що порожньо',
    emptyText: 'У вам ще немає записів. Знайди майстра — і запишись прямо звідси.',
    emptyCta: 'Знайти майстра',
  },
  ru: {
    title: 'Привет',
    morningHi: 'Доброе утро', dayHi: 'Добрый день', eveningHi: 'Добрый вечер', nightHi: 'Доброй ночи',
    upcoming: 'Ближайшая запись', details: 'Подробнее',
    regulars: 'Ваши постоянные', atMaster: 'у',
    freeSlots: 'Свободные слоты ваших мастеров', allContacts: 'Мои мастера',
    recommended: 'Рекомендуем', viewAll: 'Посмотреть все', from: 'от',
    explore: 'Категории', topCats: 'Популярное',
    cat: { beauty: 'Красота', health: 'Здоровье', pets: 'Питомцы', fitness: 'Фитнес', auto: 'Авто', home: 'Дом' },
    topcat: { hair: 'Стрижка и укладка', massage: 'Массаж', trainer: 'Тренер', grooming: 'Груминг', repair: 'Ремонт' },
    today: 'Сегодня', tomorrow: 'Завтра',
    aiConcierge: 'AI-консьерж', minSuffix: 'мин', masterFallback: 'Мастер',
    bookCta: 'Записаться',
    emptyTitle: 'Здесь пока пусто',
    emptyText: 'У вас ещё нет записей. Найди мастера — и запишись прямо отсюда.',
    emptyCta: 'Найти мастера',
  },
  en: {
    title: 'Hi',
    morningHi: 'Good morning', dayHi: 'Good afternoon', eveningHi: 'Good evening', nightHi: 'Good night',
    upcoming: 'Next appointment', details: 'View details',
    regulars: 'Your regulars', atMaster: 'at',
    freeSlots: 'Open slots from your masters', allContacts: 'My masters',
    recommended: 'Recommended', viewAll: 'See all', from: 'from',
    explore: 'Categories', topCats: 'Popular',
    cat: { beauty: 'Beauty', health: 'Health', pets: 'Pets', fitness: 'Fitness', auto: 'Auto', home: 'Home' },
    topcat: { hair: 'Hair & styling', massage: 'Massage', trainer: 'Trainer', grooming: 'Grooming', repair: 'Repair' },
    today: 'Today', tomorrow: 'Tomorrow',
    aiConcierge: 'AI concierge', minSuffix: 'min', masterFallback: 'Master',
    bookCta: 'Book',
    emptyTitle: 'Nothing here yet',
    emptyText: 'You don’t have any appointments yet. Find a master — and book right from here.',
    emptyCta: 'Find a master',
  },
};


export default function MiniAppHomePage() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { userId, fullName } = useAuthStore();
  // Имя для приветствия — берём первую часть full_name (первое имя).
  // Если профиль ещё не подгрузился — приветствие останется без имени.
  const firstName = fullName?.trim().split(/\s+/)[0] ?? '';
  // Кэш на 60с — вернулся на главную → данные мгновенно из памяти.
  type Regular = {
    master_id: string; master_name: string; master_avatar: string | null; master_slug: string;
    service_id: string; service_name: string; service_duration: number | null;
    service_price: number | null; service_currency: string | null; visit_count: number;
  };
  type CachedHome = { next: NextAppointment | null; slots: SlotItem[]; regulars: Regular[] };
  const cacheKey = userId ? `c-home:${userId}` : null;
  const initial = cacheKey ? getCached<CachedHome>(cacheKey) : undefined;
  const [next, setNext] = useState<NextAppointment | null>(initial?.next ?? null);
  const [slots, setSlots] = useState<SlotItem[]>(initial?.slots ?? []);
  const [regulars, setRegulars] = useState<Regular[]>(initial?.regulars ?? []);
  // Флаг «все три fetch'а отработали». При наличии кэша — сразу true чтобы
  // empty-state не мигал между монтированием и приходом фоновых данных.
  const [loaded, setLoaded] = useState(!!initial);
  const [lang, setLang] = useState<Lang>('uk');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as Lang | null;
      if (stored && ['uk', 'ru', 'en'].includes(stored)) setLang(stored);
    } catch {}
  }, []);

  const t = I18N[lang];

  useEffect(() => {
    if (!userId) return;
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

      // Параллелим 3 fetch'а — раньше шли последовательно (3 RTT). Теперь
      // три запроса стартуют одновременно, ждём всех — даёт ~1/3 от старого
      // времени на cold-load главной.
      const naFetch = initData
        ? fetch('/api/telegram/c/next-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData }),
          }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null);

      const slotsFetch = fetch(`/api/me/followed-slots?profileId=${userId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const regularsFetch = fetch('/api/me/regular-services')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const [naJson, slotsJson, regularsJson] = await Promise.all([
        naFetch, slotsFetch, regularsFetch,
      ]);

      // Next appointment — нормализация embedded relations
      let nextSnapshot: NextAppointment | null = null;
      const apt = naJson?.next;
      if (apt) {
        type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null };
        const a = apt as {
          id: string;
          starts_at: string;
          price: number | null;
          currency: string | null;
          master: {
            id: string;
            specialization: string | null;
            display_name: string | null;
            avatar_url: string | null;
            profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
            salon: SalonEmbed | SalonEmbed[] | null;
          } | null;
          service: { name: string } | { name: string }[] | null;
        };
        const masterProfile = Array.isArray(a.master?.profile) ? a.master?.profile[0] : a.master?.profile;
        const svc = Array.isArray(a.service) ? a.service[0] : a.service;
        const rawSalon = Array.isArray(a.master?.salon) ? a.master?.salon[0] ?? null : a.master?.salon ?? null;
        nextSnapshot = {
          id: a.id,
          starts_at: a.starts_at,
          master_id: a.master?.id ?? null,
          master_name: a.master?.display_name ?? masterProfile?.full_name ?? '—',
          master_avatar: a.master?.avatar_url ?? masterProfile?.avatar_url ?? null,
          master_specialization: a.master?.specialization ?? null,
          salon: rawSalon,
          service_name: svc?.name ?? '—',
          price: Number(a.price ?? 0),
          currency: a.currency ?? 'UAH',
        };
      }

      const slotsSnapshot = (slotsJson?.items ?? []) as SlotItem[];
      const regularsSnapshot = Array.isArray(regularsJson?.items)
        ? (regularsJson!.items as Regular[])
        : [];

      setNext(nextSnapshot);
      setSlots(slotsSnapshot);
      setRegulars(regularsSnapshot);
      if (cacheKey) {
        setCached<CachedHome>(cacheKey, {
          next: nextSnapshot,
          slots: slotsSnapshot,
          regulars: regularsSnapshot,
        });
      }
      setLoaded(true);
    })();
  }, [userId, cacheKey]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return t.nightHi;
    if (h < 12) return t.morningHi;
    if (h < 18) return t.dayHi;
    return t.eveningHi;
  }, [t]);

  const userInitials = (firstName || fullName || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <MobilePage className="od-client-mini-app">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Hello row — «Привіт, Имя» + аватар справа */}
        <div className="page-hello">
          <div>
            <div className="page-hello-greet">{firstName ? `${t.title},` : greeting}</div>
            <div className="page-hello-name">{firstName ? `${firstName} 👋` : t.title}</div>
          </div>
          <div className="avatar av-md">{userInitials || '👤'}</div>
        </div>

        <div style={{ padding: '4px 16px 0' }}>
          <HomeScreenBanner />
        </div>

        {/* Hero «Найближчий запис» — gradient cobalt + бейдж + время + услуга + кнопка */}
        {next ? (
          <Link
            href={`/telegram/activity/${next.id}`}
            onClick={() => haptic('light')}
            className="hero-scenario"
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div className="hero-badge">{t.upcoming}</div>
            <div className="hero-label">{formatDateTime(next.starts_at, lang)}</div>
            <div className="hero-title">{next.service_name}</div>
            <div className="hero-sub">
              {t.atMaster} {next.master_name}
              {next.price > 0 ? ` · ${formatMoney(next.price, next.currency)}` : ''}
              {next.salon?.name ? ` · ${next.salon.name}` : ''}
            </div>
            <span className="hero-action">
              <Calendar size={15} strokeWidth={2.25} />
              {t.details}
            </span>
          </Link>
        ) : null}

        {/* Постоянные мастер+услуга — карусель карточек как .h-card */}
        {regulars.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="feed-section" style={{ paddingBottom: 0 }}>
              <div className="feed-title">{t.regulars}</div>
            </div>
            <div className="h-scroll">
              {regulars.map((r) => (
                <button
                  key={`${r.master_id}-${r.service_id}`}
                  type="button"
                  onClick={() => {
                    haptic('light');
                    router.push(`/telegram/book?master=${r.master_id}&service=${r.service_id}`);
                  }}
                  className="h-card"
                  style={{ border: 'none', textAlign: 'left', fontFamily: 'inherit', padding: 0 }}
                >
                  <div className="h-card-img">
                    {r.master_avatar
                      ? <img src={r.master_avatar} alt="" />
                      : <Calendar size={32} strokeWidth={1.5} />}
                  </div>
                  <div className="h-card-body">
                    <div className="h-card-name">{r.service_name}</div>
                    <div className="h-card-sub">{t.atMaster} {r.master_name}</div>
                    <div className="h-card-price">
                      {formatMoney(r.service_price, 'UAH')}
                      {r.service_duration ? ` · ${r.service_duration} ${t.minSuffix}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Свободные слоты — feed-card list */}
        {slots.length > 0 && (
          <div className="feed-section">
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div className="feed-title" style={{ margin: 0 }}>{t.freeSlots}</div>
              <Link
                href="/telegram/connections"
                onClick={() => haptic('light')}
                style={{ fontSize: 13, color: 'var(--m-accent, #2563eb)', textDecoration: 'none', fontWeight: 500 }}
              >
                {t.allContacts}
              </Link>
            </div>
            {slots.slice(0, 4).map((s) => (
              <Link
                key={s.masterId + s.iso}
                href={`/telegram/book?master_id=${s.masterId}&date=${s.date}&time=${encodeURIComponent(s.time)}`}
                onClick={() => haptic('light')}
                className="feed-card"
              >
                <div className="fc-icon">
                  {s.avatar
                    ? <img src={s.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                    : <Clock size={20} />}
                </div>
                <div className="fc-info">
                  <div className="fc-title">{s.name ?? t.masterFallback}</div>
                  <div className="fc-sub">{formatSlotDate(s.date, s.time, lang)}</div>
                </div>
                <div className="fc-cta">
                  {t.bookCta} <ChevronRight size={13} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: '-2px' }} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty state — hero-scenario без бейджа */}
        {loaded && !next && regulars.length === 0 && slots.length === 0 && (
          <Link
            href="/telegram/search"
            onClick={() => haptic('light')}
            className="hero-scenario"
            style={{ textDecoration: 'none', display: 'block', marginTop: 12 }}
          >
            <div className="hero-title">{t.emptyTitle}</div>
            <div className="hero-sub" style={{ marginTop: 6 }}>{t.emptyText}</div>
            <span className="hero-action">
              {t.emptyCta}
              <ChevronRight size={15} strokeWidth={2.25} />
            </span>
          </Link>
        )}

        <div style={{ height: 12 }} />
      </motion.div>

    </MobilePage>
  );
}

const LOCALE_MAP: Record<Lang, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };
const TODAY_LABEL: Record<Lang, string> = { uk: 'Сьогодні', ru: 'Сегодня', en: 'Today' };
const TOMORROW_LABEL: Record<Lang, string> = { uk: 'Завтра', ru: 'Завтра', en: 'Tomorrow' };

function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (target.getTime() === today.getTime()) return `${TODAY_LABEL[lang]} ${time}`;
  if (target.getTime() === tomorrow.getTime()) return `${TOMORROW_LABEL[lang]} ${time}`;
  return `${d.toLocaleDateString(LOCALE_MAP[lang], { day: 'numeric', month: 'short' })} ${time}`;
}

function formatSlotDate(dateStr: string, time: string, lang: Lang): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.getTime() === today.getTime()) return `${TODAY_LABEL[lang]} ${time}`;
  if (d.getTime() === tomorrow.getTime()) return `${TOMORROW_LABEL[lang]} ${time}`;
  return `${d.toLocaleDateString(LOCALE_MAP[lang], { day: 'numeric', month: 'short' })} ${time}`;
}
