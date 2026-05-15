/** --- YAML
 * name: MiniAppHomePage
 * description: «Головна» — соответствие прототипу mini-app/. Приветствие + аватар,
 *              hero ближайшей записи ИЛИ зелёный fallback «+ Новий запис»,
 *              feed «Вільні слоти сьогодні» (2 карточки), h-scroll «Рекомендовані»
 *              из /api/marketplace/featured. Категории/AI — в Tab «Найти».
 * created: 2026-04-13
 * updated: 2026-05-15
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronRight, Plus, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-mini-app.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { formatMoney } from '@/lib/format/money';
import { MobilePage } from '@/components/miniapp/shells';
import { getCached, setCached } from '@/lib/miniapp/cache';

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
  atMaster: string;
  freeSlots: string;
  recommended: string; from: string;
  today: string; tomorrow: string;
  minSuffix: string; masterFallback: string; reviewsSuffix: string;
  bookCta: string;
  // Fallback hero когда нет ближайшей записи (по прототипу — зелёный CTA).
  emptyLabel: string; emptyTitle: string; emptySub: string; emptyCta: string;
}> = {
  uk: {
    title: 'Привіт',
    morningHi: 'Доброго ранку', dayHi: 'Доброго дня', eveningHi: 'Доброго вечора', nightHi: 'Доброї ночі',
    upcoming: 'Наступний запис', details: 'Деталі запису',
    atMaster: 'з',
    freeSlots: 'Вільні слоти сьогодні',
    recommended: 'Рекомендовані', from: 'від',
    today: 'Сьогодні', tomorrow: 'Завтра',
    minSuffix: 'хв', masterFallback: 'Майстер', reviewsSuffix: 'відгуків',
    bookCta: 'Записатися',
    emptyLabel: 'Почни день',
    emptyTitle: 'Запишись до майстра',
    emptySub: 'Більше 500 майстрів у твоєму місті',
    emptyCta: 'Новий запис',
  },
  ru: {
    title: 'Привет',
    morningHi: 'Доброе утро', dayHi: 'Добрый день', eveningHi: 'Добрый вечер', nightHi: 'Доброй ночи',
    upcoming: 'Ближайшая запись', details: 'Детали записи',
    atMaster: 'у',
    freeSlots: 'Свободные слоты сегодня',
    recommended: 'Рекомендуем', from: 'от',
    today: 'Сегодня', tomorrow: 'Завтра',
    minSuffix: 'мин', masterFallback: 'Мастер', reviewsSuffix: 'отзывов',
    bookCta: 'Записаться',
    emptyLabel: 'Начни день',
    emptyTitle: 'Запишись к мастеру',
    emptySub: 'Больше 500 мастеров в твоём городе',
    emptyCta: 'Новая запись',
  },
  en: {
    title: 'Hi',
    morningHi: 'Good morning', dayHi: 'Good afternoon', eveningHi: 'Good evening', nightHi: 'Good night',
    upcoming: 'Next appointment', details: 'View details',
    atMaster: 'with',
    freeSlots: 'Open slots today',
    recommended: 'Recommended', from: 'from',
    today: 'Today', tomorrow: 'Tomorrow',
    minSuffix: 'min', masterFallback: 'Master', reviewsSuffix: 'reviews',
    bookCta: 'Book',
    emptyLabel: 'Start your day',
    emptyTitle: 'Book a master',
    emptySub: 'Over 500 masters in your city',
    emptyCta: 'New booking',
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
  type FeaturedMaster = {
    id: string;
    slug: string;
    name: string;
    specialization: string | null;
    avatar_url: string | null;
    rating: number | null;
    reviews_count: number;
    price_from: number | null;
    currency: string | null;
  };
  type CachedHome = { next: NextAppointment | null; slots: SlotItem[]; featured: FeaturedMaster[] };
  const cacheKey = userId ? `c-home-v2:${userId}` : null;
  const initial = cacheKey ? getCached<CachedHome>(cacheKey) : undefined;
  const [next, setNext] = useState<NextAppointment | null>(initial?.next ?? null);
  const [slots, setSlots] = useState<SlotItem[]>(initial?.slots ?? []);
  const [featured, setFeatured] = useState<FeaturedMaster[]>(initial?.featured ?? []);
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

      const featuredFetch = fetch('/api/marketplace/featured?limit=12')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const [naJson, slotsJson, featuredJson] = await Promise.all([
        naFetch, slotsFetch, featuredFetch,
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
      type FeaturedRaw = {
        id: string;
        slug: string | null;
        fullName: string;
        avatarUrl: string | null;
        specialization: string | null;
        rating: number | null;
        reviewsCount: number;
        topServices: Array<{ name: string; price: number; currency: string }>;
      };
      const featuredSnapshot: FeaturedMaster[] = Array.isArray(featuredJson?.items)
        ? (featuredJson!.items as FeaturedRaw[])
            .filter((m) => !!m.slug)
            .map((m) => {
              const first = m.topServices?.[0];
              return {
                id: m.id,
                slug: m.slug!,
                name: m.fullName,
                specialization: m.specialization,
                avatar_url: m.avatarUrl,
                rating: m.rating,
                reviews_count: m.reviewsCount,
                price_from: first?.price ?? null,
                currency: first?.currency ?? 'UAH',
              };
            })
        : [];

      setNext(nextSnapshot);
      setSlots(slotsSnapshot);
      setFeatured(featuredSnapshot);
      if (cacheKey) {
        setCached<CachedHome>(cacheKey, {
          next: nextSnapshot,
          slots: slotsSnapshot,
          featured: featuredSnapshot,
        });
      }
    })();
  }, [userId, cacheKey]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return t.nightHi;
    if (h < 12) return t.morningHi;
    if (h < 18) return t.dayHi;
    return t.eveningHi;
  }, [t]);

  return (
    <MobilePage className="od-client-mini-app">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Hello row — «Привіт, Имя» без аватара */}
        <div className="page-hello">
          <div>
            <div className="page-hello-greet">{firstName ? `${t.title},` : greeting}</div>
            <div className="page-hello-name">{firstName ? `${firstName} 👋` : t.title}</div>
          </div>
        </div>

        {/* Hero — ближайший запис ИЛИ зелёный fallback «+ Новий запис» (по прототипу) */}
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
        ) : (
          <Link
            href="/telegram/search"
            onClick={() => haptic('light')}
            className="hero-scenario"
            style={{
              textDecoration: 'none',
              display: 'block',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            }}
          >
            <div className="hero-label">{t.emptyLabel}</div>
            <div className="hero-title">{t.emptyTitle}</div>
            <div className="hero-sub">{t.emptySub}</div>
            <span className="hero-action">
              <Plus size={15} strokeWidth={2.25} />
              {t.emptyCta}
            </span>
          </Link>
        )}

        {/* Вільні слоти сьогодні — 2 feed-card (по прототипу) */}
        {slots.length > 0 && (
          <div className="feed-section">
            <div className="feed-title">{t.freeSlots}</div>
            {slots.slice(0, 2).map((s) => (
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

        {/* Рекомендовані — h-scroll featured masters (по прототипу) */}
        {featured.length > 0 && (
          <>
            <div className="feed-section" style={{ paddingBottom: 0 }}>
              <div className="feed-title">{t.recommended}</div>
            </div>
            <div className="h-scroll" style={{ marginTop: 8, paddingBottom: 4 }}>
              {featured.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    haptic('light');
                    router.push(`/telegram/book?master_id=${m.id}`);
                  }}
                  className="h-card"
                  style={{ border: 'none', textAlign: 'left', fontFamily: 'inherit', padding: 0 }}
                >
                  <div className="h-card-img">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" />
                      : <User size={32} strokeWidth={1.5} />}
                  </div>
                  <div className="h-card-body">
                    <div className="h-card-name">{m.name}</div>
                    <div className="h-card-sub">
                      ⭐ {m.rating?.toFixed(1) ?? '—'} · {m.reviews_count} {t.reviewsSuffix}
                    </div>
                    {m.price_from != null && (
                      <div className="h-card-price">
                        {t.from} {formatMoney(m.price_from, m.currency)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
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
