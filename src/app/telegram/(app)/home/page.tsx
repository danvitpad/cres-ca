/** --- YAML
 * name: MiniAppHomePage
 * description: «Головна» Mini App — визуал из mobile-client/home мокапа.
 *              Top bar (сьогодні + bell), greeting, search pill, Hero «Наступний запис»
 *              (или пустой CTA), «Вільні слоти ваших майстрів», «Ваші постійні»
 *              (повторити в 1 клік), 8 категорій, «Рекомендовані» horizontal scroll.
 *              Все fetch'и кэшируются на 60с.
 * created: 2026-04-13
 * updated: 2026-05-17
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search, MapPin, Clock, Coins, ChevronRight, CalendarPlus, Repeat, Bell,
  Scissors, Hand, Smile, Activity, Eye, Zap, Droplets, MoreHorizontal, Star,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-mini-app.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
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
  service_duration: number | null;
  price: number;
  currency: string | null;
}
interface SlotItem {
  masterId: string;
  name: string | null;
  avatar: string | null;
  specialization?: string | null;
  date: string;
  time: string;
  iso: string;
  service?: string | null;
  duration?: number | null;
  price?: number | null;
  // Средняя оценка и кол-во отзывов — рендерим звёздочкой возле имени.
  rating?: number | null;
  reviewsCount?: number;
}
interface RegularItem {
  master_id: string;
  master_name: string;
  service_id: string;
  service_name: string;
  service_price: number | null;
  visit_count: number;
}
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
type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  greeting: string;
  searchHint: string;
  upcomingLabel: string;
  atMaster: string;
  freeSlots: string;
  regulars: string;
  findNew: string;
  recommended: string;
  seeAll: string;
  emptyLabel: string; emptyTitle: string; emptySub: string; emptyCta: string;
  today: string; tomorrow: string;
  duration: string;
}> = {
  uk: {
    greeting: 'Привіт',
    searchHint: 'Майстер, послуга, місто…',
    upcomingLabel: 'Наступний запис',
    atMaster: 'у',
    freeSlots: 'Вільні слоти ваших майстрів',
    regulars: 'Ваші постійні',
    findNew: 'Знайти нового майстра',
    recommended: 'Рекомендовані',
    seeAll: 'Усі',
    emptyLabel: 'Поки немає записів',
    emptyTitle: 'Знайти майстра',
    emptySub: 'Більше 500 майстрів у твоєму місті',
    emptyCta: 'До пошуку',
    today: 'сьогодні',
    tomorrow: 'завтра',
    duration: 'хв',
  },
  ru: {
    greeting: 'Привет',
    searchHint: 'Мастер, услуга, город…',
    upcomingLabel: 'Ближайшая запись',
    atMaster: 'у',
    freeSlots: 'Свободные слоты ваших мастеров',
    regulars: 'Ваши постоянные',
    findNew: 'Найти нового мастера',
    recommended: 'Рекомендуем',
    seeAll: 'Все',
    emptyLabel: 'Пока нет записей',
    emptyTitle: 'Найти мастера',
    emptySub: 'Больше 500 мастеров в твоём городе',
    emptyCta: 'К поиску',
    today: 'сегодня',
    tomorrow: 'завтра',
    duration: 'мин',
  },
  en: {
    greeting: 'Hi',
    searchHint: 'Master, service, city…',
    upcomingLabel: 'Next appointment',
    atMaster: 'with',
    freeSlots: 'Open slots of your masters',
    regulars: 'Your regulars',
    findNew: 'Find a new master',
    recommended: 'Recommended',
    seeAll: 'All',
    emptyLabel: 'No appointments yet',
    emptyTitle: 'Find a master',
    emptySub: 'Over 500 masters in your city',
    emptyCta: 'Open search',
    today: 'today',
    tomorrow: 'tomorrow',
    duration: 'min',
  },
};

const CATEGORIES = [
  { key: 'hair',    icon: Scissors,        l: { uk: 'Волосся',  ru: 'Волосы',   en: 'Hair' } },
  { key: 'nails',   icon: Hand,            l: { uk: 'Нігті',    ru: 'Ногти',    en: 'Nails' } },
  { key: 'face',    icon: Smile,           l: { uk: 'Обличчя',  ru: 'Лицо',     en: 'Face' } },
  { key: 'massage', icon: Activity,        l: { uk: 'Масаж',    ru: 'Массаж',   en: 'Massage' } },
  { key: 'brows',   icon: Eye,             l: { uk: 'Брови',    ru: 'Брови',    en: 'Brows' } },
  { key: 'laser',   icon: Zap,             l: { uk: 'Лазер',    ru: 'Лазер',    en: 'Laser' } },
  { key: 'skin',    icon: Droplets,        l: { uk: 'Шкіра',    ru: 'Кожа',     en: 'Skin' } },
  { key: 'all',     icon: MoreHorizontal,  l: { uk: 'Усі',      ru: 'Все',      en: 'All' } },
] as const;

export default function MiniAppHomePage() {
  const { haptic } = useTelegram();
  const { userId, fullName } = useAuthStore();
  const firstName = fullName?.trim().split(/\s+/)[0] ?? '';

  type CachedHome = {
    next: NextAppointment | null;
    slots: SlotItem[];
    regulars: RegularItem[];
    featured: FeaturedMaster[];
  };
  const cacheKey = userId ? `c-home-v3:${userId}` : null;
  const initial = cacheKey ? getCached<CachedHome>(cacheKey) : undefined;
  const [next, setNext] = useState<NextAppointment | null>(initial?.next ?? null);
  const [slots, setSlots] = useState<SlotItem[]>(initial?.slots ?? []);
  const [regulars, setRegulars] = useState<RegularItem[]>(initial?.regulars ?? []);
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
        } catch {}
        return null;
      })();

      // 4 fetch'а параллельно (раньше было 3 + не было regulars).
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

      const featuredFetch = fetch('/api/marketplace/featured?limit=8')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const [naJson, slotsJson, regularsJson, featuredJson] = await Promise.all([
        naFetch, slotsFetch, regularsFetch, featuredFetch,
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
          service: { name: string; duration_minutes?: number | null } | { name: string; duration_minutes?: number | null }[] | null;
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
          service_duration: svc?.duration_minutes ?? null,
          price: Number(a.price ?? 0),
          currency: a.currency ?? 'UAH',
        };
      }

      const slotsSnapshot = (slotsJson?.items ?? []) as SlotItem[];
      const regularsSnapshot = (Array.isArray(regularsJson?.items) ? regularsJson.items : []) as RegularItem[];

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
      setRegulars(regularsSnapshot.slice(0, 3));
      setFeatured(featuredSnapshot);
      if (cacheKey) {
        setCached<CachedHome>(cacheKey, {
          next: nextSnapshot,
          slots: slotsSnapshot,
          regulars: regularsSnapshot.slice(0, 3),
          featured: featuredSnapshot,
        });
      }
    })();
  }, [userId, cacheKey]);

  return (
    <MobilePage className="od-client-mini-app">
      {/* Top bar: только bell в правом углу. По запросу 2026-05-19 убран
          «Сегодня · 19 мая Привет, Дмитрий 👋» — дата и приветствие не нужны. */}
      <div className="mc-top" style={{ justifyContent: 'flex-end' }}>
        <Link
          href="/telegram/notifications"
          onClick={() => haptic('light')}
          aria-label="Сповіщення"
          className="mc-icbtn mc-icbtn-dot"
        >
          <Bell size={16} strokeWidth={2} />
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        {/* Search pill → /telegram/search */}
        <Link
          href="/telegram/search"
          onClick={() => haptic('light')}
          className="mc-pill"
        >
          <Search size={18} strokeWidth={2} />
          <span className="mc-pill-txt">{t.searchHint}</span>
        </Link>

        {/* Hero — next appointment или empty-CTA */}
        {next ? (
          <Link
            href={`/telegram/activity/${next.id}`}
            onClick={() => haptic('light')}
            className="mc-hero"
          >
            <div className="mc-hero-lab">{t.upcomingLabel}</div>
            <div className="mc-hero-t">{next.service_name}</div>
            <div className="mc-hero-s">
              {t.atMaster} {next.master_name} · {formatWhen(next.starts_at, lang)}
            </div>
            <div className="mc-hero-m">
              {next.salon?.city && (
                <span><MapPin size={11} /> {next.salon.city}</span>
              )}
              {next.service_duration && (
                <span><Clock size={11} /> {next.service_duration} {t.duration}</span>
              )}
              {next.price > 0 && (
                <span><Coins size={11} /> ₴{Math.round(next.price)}</span>
              )}
            </div>
            <span className="mc-hero-cta">
              Деталі <ChevronRight size={11} strokeWidth={2.5} />
            </span>
          </Link>
        ) : (
          <Link
            href="/telegram/search"
            onClick={() => haptic('light')}
            className="mc-hero"
          >
            <div className="mc-hero-lab">{t.emptyLabel}</div>
            <div className="mc-hero-t">{t.emptyTitle}</div>
            <div className="mc-hero-s">{t.emptySub}</div>
            <span className="mc-hero-cta">
              <Search size={11} strokeWidth={2.5} /> {t.emptyCta}
            </span>
          </Link>
        )}

        {/* Free slots — 4 карточки */}
        {slots.length > 0 && (
          <>
            <div className="mc-section-head">
              <span className="mc-section-title">{t.freeSlots}</span>
              <Link href="/telegram/connections" onClick={() => haptic('light')}>{t.seeAll}</Link>
            </div>
            <div className="mc-slots">
              {slots.slice(0, 4).map((s) => <SlotCard key={s.masterId + s.iso} slot={s} lang={lang} t={t} haptic={haptic} />)}
            </div>
          </>
        )}

        {/* Regulars — повторити запис */}
        {regulars.length > 0 && (
          <>
            <div className="mc-section-head">
              <span className="mc-section-title">{t.regulars}</span>
              <Link href="/telegram/activity?tab=past" onClick={() => haptic('light')}>{t.seeAll}</Link>
            </div>
            <div className="mc-reg">
              {regulars.map((r) => (
                <Link
                  key={`${r.master_id}-${r.service_id}`}
                  href={`/telegram/book?master_id=${r.master_id}&service_id=${r.service_id}`}
                  onClick={() => haptic('light')}
                  className="mc-reg-row"
                >
                  <div className="mc-reg-av">{initialsOf(r.master_name)}</div>
                  <div className="mc-reg-i">
                    <div className="mc-reg-n">{r.service_name}</div>
                    <div className="mc-reg-s">
                      {r.master_name} · {r.visit_count} {plural(r.visit_count, lang)}
                      {r.service_price != null ? ` · ₴${Math.round(Number(r.service_price))}` : ''}
                    </div>
                  </div>
                  <span className="mc-reg-cta" aria-label="Повторити">
                    <Repeat size={15} strokeWidth={2} />
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Categories */}
        <div className="mc-section-title">{t.findNew}</div>
        <div className="mc-cats">
          {CATEGORIES.map(({ key, icon: Icon, l }) => (
            <Link
              key={key}
              href={`/telegram/search?cat=${key}`}
              onClick={() => haptic('light')}
              className="mc-cat"
            >
              <span className="mc-cat-ic"><Icon size={18} strokeWidth={2} /></span>
              <span className="mc-cat-l">{l[lang]}</span>
            </Link>
          ))}
        </div>

        {/* Recommended (h-scroll) */}
        {featured.length > 0 && (
          <>
            <div className="mc-section-head">
              <span className="mc-section-title">{t.recommended}</span>
              <Link href="/telegram/search" onClick={() => haptic('light')}>{t.seeAll}</Link>
            </div>
            <div className="mc-recs">
              {featured.map((m) => (
                <Link
                  key={m.id}
                  href={`/telegram/search/${m.id}`}
                  onClick={() => haptic('light')}
                  className="mc-rec"
                >
                  <div className="mc-rec-c">
                    <div className="mc-rec-av">
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt="" />
                        : initialsOf(m.name)}
                    </div>
                  </div>
                  <div className="mc-rec-b">
                    <div className="mc-rec-n">{m.name}</div>
                    <div className="mc-rec-s">{m.specialization || '—'}</div>
                    <div className="mc-rec-m">
                      <span className="mc-rec-r">
                        <Star size={10} /> {m.rating?.toFixed(1) ?? '—'} · {m.reviews_count}
                      </span>
                      {m.price_from != null && (
                        <span className="mc-rec-p">від ₴{Math.round(m.price_from)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <div style={{ height: 12 }} />
      </motion.div>
    </MobilePage>
  );
}

/* ───── Helpers ───── */

const LOCALE_MAP: Record<Lang, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };

function SlotCard({ slot, lang, t, haptic }: {
  slot: SlotItem;
  lang: Lang;
  t: typeof I18N[Lang];
  haptic: (k?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection') => void;
}) {
  const d = new Date(slot.iso);
  const isToday = isSameDay(d, new Date());
  const isTomorrow = isSameDay(d, addDays(new Date(), 1));
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const timeLabel = isToday
    ? timeStr
    : isTomorrow
      ? `${t.tomorrow} ${timeStr}`
      : `${d.toLocaleDateString(LOCALE_MAP[lang], { day: 'numeric', month: 'short' })} ${timeStr}`;

  return (
    <Link
      href={`/telegram/book?master_id=${slot.masterId}&date=${slot.date}&time=${encodeURIComponent(slot.time)}`}
      onClick={() => haptic('light')}
      className="mc-slot"
    >
      <div className={`mc-slot-av ${isToday ? 'online' : ''}`}>
        {slot.avatar
          ? <img src={slot.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
          : initialsOf(slot.name ?? '?')}
      </div>
      <div className="mc-slot-i">
        <div className="mc-slot-n" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>{slot.name ?? '—'}</span>
          {slot.rating != null && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontSize: 11, fontWeight: 600, color: '#f59e0b',
              }}
              aria-label={`Рейтинг ${slot.rating.toFixed(1)}`}
            >
              <Star size={11} fill="#f59e0b" strokeWidth={0} />
              {slot.rating.toFixed(1)}
              {slot.reviewsCount ? (
                <span style={{ color: 'var(--m-text-tertiary, #94a3b8)', fontWeight: 500 }}>
                  · {slot.reviewsCount}
                </span>
              ) : null}
            </span>
          )}
        </div>
        {(slot.service || slot.specialization) && (
          <div className="mc-slot-s">
            {slot.service
              ? `${slot.service}${slot.duration ? ` · ${slot.duration} ${t.duration}` : ''}`
              : slot.specialization}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className={`mc-slot-t ${!isToday ? 'tom' : ''}`}>{timeLabel}</div>
        {slot.price != null && <div className="mc-slot-p">₴{Math.round(slot.price)}</div>}
      </div>
      <button className="mc-slot-btn" aria-label="Записатись">
        <CalendarPlus size={14} strokeWidth={2} />
      </button>
    </Link>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, lang: Lang): string {
  if (lang === 'en') return n === 1 ? 'time' : 'times';
  const m10 = n % 10, m100 = n % 100;
  if (lang === 'uk') {
    if (m10 === 1 && m100 !== 11) return 'раз';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'рази';
    return 'разів';
  }
  // ru
  if (m10 === 1 && m100 !== 11) return 'раз';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'раза';
  return 'раз';
}

function formatWhen(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date();
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (isSameDay(d, today)) return `${I18N[lang].today} ${time}`;
  if (isSameDay(d, addDays(today, 1))) return `${I18N[lang].tomorrow} ${time}`;
  return `${d.toLocaleDateString(LOCALE_MAP[lang], { day: 'numeric', month: 'short' })} ${time}`;
}
