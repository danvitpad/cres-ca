/** --- YAML
 * name: MiniAppHomePage
 * description: «Для вас» — Fresha-premium домашний экран клиента. Next appointment
 *              hero + свободные окна у контактов + Рекомендуемые мастера + Explore
 *              категории. Светлая тема, premium-карточки, анимация.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { formatMoney } from '@/lib/format/money';
import {
  MobilePage,
  PageHeader,
  SectionHeader,
  AvatarCircle,
} from '@/components/miniapp/shells';
import { TapButton } from '@/components/miniapp/tap-press';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, HERO_GRADIENT } from '@/components/miniapp/design';
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
  regulars: string; atMaster: string;
  freeSlots: string; allContacts: string;
  recommended: string; viewAll: string; from: string;
  explore: string; topCats: string;
  cat: { beauty: string; health: string; pets: string; fitness: string; auto: string; home: string };
  topcat: { hair: string; massage: string; trainer: string; grooming: string; repair: string };
  today: string; tomorrow: string;
  aiConcierge: string; minSuffix: string; masterFallback: string;
  // Empty state — когда у клиента нет ни записей, ни постоянных, ни слотов.
  emptyTitle: string; emptyText: string; emptyCta: string;
}> = {
  uk: {
    title: 'Привіт',
    morningHi: 'Доброго ранку', dayHi: 'Доброго дня', eveningHi: 'Доброго вечора', nightHi: 'Доброї ночі',
    upcoming: 'Найближчий запис', details: 'Детальніше',
    regulars: 'Твої постійні', atMaster: 'у',
    freeSlots: 'Вільні слоти твоїх майстрів', allContacts: 'Мої майстри',
    recommended: 'Рекомендуємо', viewAll: 'Дивитися всі', from: 'від',
    explore: 'Категорії', topCats: 'Популярне',
    cat: { beauty: 'Краса', health: "Здоров'я", pets: 'Тварини', fitness: 'Фітнес', auto: 'Авто', home: 'Дім' },
    topcat: { hair: 'Стрижка та укладка', massage: 'Масаж', trainer: 'Тренер', grooming: 'Грумінг', repair: 'Ремонт' },
    today: 'Сьогодні', tomorrow: 'Завтра',
    aiConcierge: 'AI-консьєрж', minSuffix: 'хв', masterFallback: 'Майстер',
    emptyTitle: 'Поки що порожньо',
    emptyText: 'У тебе ще немає записів. Знайди майстра — і запишись прямо звідси.',
    emptyCta: 'Знайти майстра',
  },
  ru: {
    title: 'Привет',
    morningHi: 'Доброе утро', dayHi: 'Добрый день', eveningHi: 'Добрый вечер', nightHi: 'Доброй ночи',
    upcoming: 'Ближайшая запись', details: 'Подробнее',
    regulars: 'Твои постоянные', atMaster: 'у',
    freeSlots: 'Свободные слоты твоих мастеров', allContacts: 'Мои мастера',
    recommended: 'Рекомендуем', viewAll: 'Посмотреть все', from: 'от',
    explore: 'Категории', topCats: 'Популярное',
    cat: { beauty: 'Красота', health: 'Здоровье', pets: 'Питомцы', fitness: 'Фитнес', auto: 'Авто', home: 'Дом' },
    topcat: { hair: 'Стрижка и укладка', massage: 'Массаж', trainer: 'Тренер', grooming: 'Груминг', repair: 'Ремонт' },
    today: 'Сегодня', tomorrow: 'Завтра',
    aiConcierge: 'AI-консьерж', minSuffix: 'мин', masterFallback: 'Мастер',
    emptyTitle: 'Здесь пока пусто',
    emptyText: 'У тебя ещё нет записей. Найди мастера — и запишись прямо отсюда.',
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

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <PageHeader
          title={firstName ? `${t.title}, ${firstName}` : t.title}
          subtitle={greeting}
          /* AI-консьерж переехал в Tab «Найти» как главный CTA сверху —
             на личной главной шапка чистая. */
        />

        {/* Next appointment hero — gradient when есть, обычный если нет */}
        {next ? (
          <Link
            href={`/telegram/activity/${next.id}`}
            onClick={() => haptic('light')}
            style={{
              ...HERO_GRADIENT,
              margin: `0 ${PAGE_PADDING_X}px`,
              padding: 22,
              borderRadius: R.lg,
              color: '#fff',
              boxShadow: SHADOW.elevated,
              textDecoration: 'none',
              display: 'block',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Calendar size={13} /> {t.upcoming}
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, marginTop: 8, marginBottom: 4, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {next.service_name}
            </p>
            <p style={{ fontSize: 14, opacity: 0.95, margin: 0 }}>
              {formatDateTime(next.starts_at, lang)} · {next.master_name}
            </p>
            {next.salon?.name && (
              <p style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                {next.salon.name}{next.salon.city ? ` · ${next.salon.city}` : ''}
              </p>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14, fontSize: 13, fontWeight: 700 }}>
              {t.details} <ChevronRight size={14} />
            </div>
          </Link>
        ) : null}

        {/* Твои постоянные — мастер+услуга где было ≥3 визитов.
            paddingX добавлен чтобы заголовок и первая карточка не лепились
            к левому краю экрана (раньше прилипало в Mini App клиента). */}
        {regulars.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SectionHeader title={t.regulars} rightLabel="" />
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                padding: `0 ${PAGE_PADDING_X}px 4px`,
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {regulars.map((r) => (
                <TapButton
                  key={`${r.master_id}-${r.service_id}`}
                  onClick={() => {
                    haptic('light');
                    router.push(`/telegram/book?master=${r.master_id}&service=${r.service_id}`);
                  }}
                  style={{
                    minWidth: 200,
                    flex: '0 0 auto',
                    border: `1px solid ${T.borderSubtle}`,
                    borderRadius: R.md,
                    background: T.surface,
                    padding: 12,
                    textAlign: 'left',
                    scrollSnapAlign: 'start',
                    minHeight: 88,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.service_name}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.atMaster} {r.master_name}</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: T.success, fontWeight: 700 }}>
                    {formatMoney(r.service_price, 'UAH')}
                    {r.service_duration ? ` · ${r.service_duration} ${t.minSuffix}` : ''}
                  </div>
                </TapButton>
              ))}
            </div>
          </div>
        )}

        {/* Свободные окна у моих контактов */}
        {slots.length > 0 && (
          <div>
            <SectionHeader title={t.freeSlots} href="/telegram/connections" rightLabel={t.allContacts} />
            <ul
              style={{
                listStyle: 'none',
                padding: `0 ${PAGE_PADDING_X}px`,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {slots.slice(0, 4).map((s) => (
                <li key={s.masterId + s.iso}>
                  <Link
                    href={`/telegram/book?master_id=${s.masterId}&date=${s.date}&time=${encodeURIComponent(s.time)}`}
                    onClick={() => haptic('light')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      background: T.surface,
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: R.md,
                      textDecoration: 'none',
                      color: T.text,
                    }}
                  >
                    <AvatarCircle url={s.avatar} name={s.name ?? t.masterFallback} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name ?? t.masterFallback}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, ...TYPE.caption }}>
                        <Clock size={13} />
                        {formatSlotDate(s.date, s.time, lang)}
                      </div>
                    </div>
                    <ChevronRight size={18} color={T.textTertiary} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state — показываем ТОЛЬКО когда все три fetch'а уже
            отработали и реально нечего показать. Без флага loaded
            empty-state мигает в первую секунду до прихода данных. */}
        {loaded && !next && regulars.length === 0 && slots.length === 0 && (
          <Link
            href="/telegram/search"
            onClick={() => haptic('light')}
            style={{
              ...HERO_GRADIENT,
              margin: `12px ${PAGE_PADDING_X}px 0`,
              padding: 24,
              borderRadius: R.lg,
              color: '#fff',
              boxShadow: SHADOW.elevated,
              textDecoration: 'none',
              display: 'block',
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              {t.emptyTitle}
            </p>
            <p style={{ fontSize: 14, marginTop: 8, marginBottom: 0, opacity: 0.92, lineHeight: 1.4 }}>
              {t.emptyText}
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14, fontSize: 13, fontWeight: 700 }}>
              {t.emptyCta} <ChevronRight size={14} />
            </div>
          </Link>
        )}

        <div style={{ height: 8 }} />
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
