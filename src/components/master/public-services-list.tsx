/** --- YAML
 * name: PublicServicesList
 * description: Fresha-style список услуг для публичной страницы мастера.
 *              Вертикальный список карточек: имя жирным, длительность серым ниже,
 *              цена жирной строкой. Справа outlined-pill «Записаться» (ведёт на /book
 *              c предзаполнением service+master). Между карточками gap, без border'ов
 *              на самих карточках — только тонкая граница вокруг группы (Fresha-style).
 *              Категории — pill-табы сверху с anchor-scroll к подсекциям.
 * created: 2026-04-26
 * --- */

'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { formatMoney } from '@/lib/format/money';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | null;
  currency: string | null;
  category: { name: string } | null;
}

interface Props {
  services: Service[];
  masterId: string;
  locale?: string;
}

const UNCATEGORIZED_LABEL = 'Услуги';

function formatDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

export function PublicServicesList({ services, masterId, locale = 'ru' }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) {
      const cat = s.category?.name?.trim() || UNCATEGORIZED_LABEL;
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }, [services]);

  const [active, setActive] = useState<string>(groups[0]?.name ?? '');
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  if (groups.length === 0) return null;

  const showPills = groups.length > 1;

  function jumpTo(name: string) {
    setActive(name);
    const el = groupRefs.current[name];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <div className="space-y-5">
      {showPills && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => {
            const isActive = active === g.name;
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => jumpTo(g.name)}
                className={
                  'whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ' +
                  (isActive
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')
                }
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <section
            key={g.name}
            ref={(el) => {
              groupRefs.current[g.name] = el;
            }}
          >
            {showPills && (
              <h3 className="mb-3 text-[15px] font-bold text-neutral-900">{g.name}</h3>
            )}

            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-[16px] border border-neutral-200 bg-white">
              {g.items.map((s) => (
                <li key={s.id}>
                  <ServiceRow service={s} masterId={masterId} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ServiceRow({ service, masterId, locale }: { service: Service; masterId: string; locale: string }) {
  const duration = formatDuration(service.duration_minutes);
  const priceStr =
    typeof service.price === 'number' && service.price > 0
      ? formatMoney(service.price, (service.currency || 'UAH').toUpperCase())
      : null;
  const name = service.name?.trim() || 'Услуга';
  const bookHref = `/${locale}/book?master=${masterId}&service=${service.id}`;

  return (
    <div className="flex items-start gap-4 px-5 py-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-semibold leading-snug text-neutral-900">{name}</p>
        {(duration || service.description) && (
          <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
            {duration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {duration}
              </span>
            )}
            {service.description && (
              <span className="line-clamp-1">
                {duration ? ' · ' : ''}
                {service.description}
              </span>
            )}
          </p>
        )}
        {priceStr && (
          <p className="pt-1 text-[15px] font-bold text-neutral-900">{priceStr}</p>
        )}
      </div>
      <Link
        href={bookHref}
        data-book-cta="true"
        data-book-service={service.id}
        className="shrink-0 rounded-full border border-neutral-900 px-5 py-2 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white active:scale-[0.98]"
      >
        Записаться
      </Link>
    </div>
  );
}
