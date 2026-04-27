/** --- YAML
 * name: ClientFeedPage
 * description: Утилитарная лента — ближайшие свободные окна у мастеров и салонов из контактов клиента.
 *              Не Instagram-feed: нет лайков/комментов/постов с фото, только slot-карточки.
 * created: 2026-04-14
 * updated: 2026-04-25
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, Sparkles, ChevronRight, Loader2, Search } from 'lucide-react';
import { FeaturedMastersStrip } from '@/components/client/featured-masters-strip';

interface SalonEmbed {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
}

interface MasterRef {
  id: string;
  name: string | null;
  avatar: string | null;
  specialization: string | null;
  salon: SalonEmbed | null;
}

interface ServiceRef {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number | null;
}

interface FeedItem {
  id: string;
  master: MasterRef | null;
  service: ServiceRef | null;
  title: string | null;
  body: string | null;
  starts_at: string | null;
  created_at: string;
}

export default function ClientFeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const c = typeof window !== 'undefined' ? localStorage.getItem('cres-ca-city') : null;
      if (c) setCity(c);
    } catch {}
    (async () => {
      try {
        const res = await fetch('/api/feed');
        if (!res.ok) {
          if (res.status === 401) setError('unauthorized');
          else setError('error');
          return;
        }
        const data = await res.json();
        setItems((data.items ?? []) as FeedItem[]);
      } catch {
        setError('network');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold tracking-tight">Свободные окна</h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Ближайшие открытые часы у твоих контактов — мастеров, салонов и команд.
        </p>
      </header>

      {/* Рекомендации показываем ВСЕГДА — без фильтра по подписке клиента,
          чтобы новый пользователь сразу видел кого можно записать. Будем
          монетизировать когда поток подключится. */}
      <FeaturedMastersStrip city={city} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        </div>
      ) : error === 'unauthorized' ? (
        <EmptyCard
          title="Войди, чтобы увидеть свободные окна"
          desc="Лента собирается из подписок на мастеров и салоны."
          ctaHref="/auth/login"
          ctaLabel="Войти"
        />
      ) : items.length === 0 ? (
        <>
          <EmptyCard
            title="Пока нет твоих контактов"
            desc="Добавь в контакты любимых мастеров и салоны — здесь будут их ближайшие свободные окна и акции."
            ctaHref="/search"
            ctaLabel="Найти мастеров"
          />
          <CategoriesBlock />
        </>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <SlotCard key={it.id} item={it} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SlotCard({ item }: { item: FeedItem }) {
  const masterName = item.master?.name ?? 'Мастер';
  const salonName = item.master?.salon?.name;
  const city = item.master?.salon?.city;
  const startsAt = item.starts_at ? new Date(item.starts_at) : null;
  const price = item.service?.price ?? null;
  const duration = item.service?.duration_minutes ?? null;

  const dateParam = startsAt ? startsAt.toISOString().slice(0, 10) : null;
  const timeParam = startsAt
    ? `${startsAt.getHours().toString().padStart(2, '0')}:${startsAt.getMinutes().toString().padStart(2, '0')}`
    : null;
  const bookHref = `/book?master=${item.master?.id ?? ''}${
    item.service?.id ? `&service=${item.service.id}` : ''
  }${dateParam ? `&date=${dateParam}` : ''}${timeParam ? `&time=${encodeURIComponent(timeParam)}` : ''}`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={bookHref}
        className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md sm:p-5"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-base font-semibold text-neutral-600 sm:size-14">
            {item.master?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.master.avatar} alt="" className="size-full object-cover" />
            ) : (
              (masterName[0] ?? '?').toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-neutral-900">
              {item.service?.name ?? item.title ?? 'Свободное окно'}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-neutral-600">
              {masterName}
              {item.master?.specialization ? ` · ${item.master.specialization}` : ''}
            </p>
            {(salonName || city) && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-neutral-500">
                <MapPin className="size-3" />
                {salonName}
                {city ? ` · ${city}` : ''}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {startsAt && (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-violet-700">
                  <Calendar className="size-3.5" />
                  {formatDateTime(startsAt)}
                </span>
              )}
              {duration && (
                <span className="inline-flex items-center gap-1 text-[12px] text-neutral-500">
                  <Clock className="size-3" />
                  {duration} мин
                </span>
              )}
              {price !== null && (
                <span className="text-[13px] font-semibold text-neutral-900">
                  {Math.round(price).toLocaleString('ru-RU')} грн
                </span>
              )}
            </div>
            {item.body && (
              <p className="mt-2 line-clamp-2 text-[12px] text-neutral-600">{item.body}</p>
            )}
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-300" />
        </div>
      </Link>
    </motion.li>
  );
}

/* Quick-pick category chips shown when feed is empty —
 * gives the client a discovery starting point instead of a dead-end empty screen.
 * Categories mirror the universal vertical list (no beauty bias).
 */
const CATEGORIES: { key: string; label: string; emoji: string; q: string }[] = [
  { key: 'beauty',    label: 'Красота',     emoji: '💅', q: 'красота' },
  { key: 'health',    label: 'Здоровье',    emoji: '🩺', q: 'здоровье' },
  { key: 'wellness',  label: 'Велнес',      emoji: '🌿', q: 'велнес' },
  { key: 'massage',   label: 'Массаж',      emoji: '💆', q: 'массаж' },
  { key: 'fitness',   label: 'Фитнес',      emoji: '🏋️', q: 'фитнес' },
  { key: 'auto',      label: 'Авто',        emoji: '🚗', q: 'авто' },
  { key: 'home',      label: 'Дом',         emoji: '🛠️', q: 'ремонт' },
  { key: 'pets',      label: 'Питомцы',     emoji: '🐾', q: 'груминг' },
  { key: 'education', label: 'Образование', emoji: '📚', q: 'обучение' },
  { key: 'tattoo',    label: 'Тату',        emoji: '🎨', q: 'тату' },
];

function CategoriesBlock() {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
        Что ищем сегодня?
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/search?q=${encodeURIComponent(c.q)}`}
            className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[13px] font-medium text-neutral-800 transition-all hover:-translate-y-0.5 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <span className="text-[18px]">{c.emoji}</span>
            <span className="truncate">{c.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyCard({
  title,
  desc,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  desc: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <Sparkles className="size-5" />
      </div>
      <h2 className="mt-4 text-[16px] font-semibold text-neutral-900">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-neutral-500">{desc}</p>
      <Link
        href={ctaHref}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700"
      >
        <Search className="size-4" />
        {ctaLabel}
      </Link>
    </div>
  );
}

function formatDateTime(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (target.getTime() === today.getTime()) return `Сегодня · ${time}`;
  if (target.getTime() === tomorrow.getTime()) return `Завтра · ${time}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${time}`;
}
