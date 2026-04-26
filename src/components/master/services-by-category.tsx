/** --- YAML
 * name: ServicesByCategory
 * description: Список услуг сгруппированных по категориям + горизонтальная pill-навигация
 *              категорий. Fresha-style: «Рекомендуемые / Маникюр / Педикюр / ...».
 *              При клике pill — скролл к подсекции. Можно фильтровать через `?cat=`.
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
  preparation?: string | null;
  aftercare?: string | null;
  faq?: { q: string; a: string }[] | null;
}

interface Props {
  services: Service[];
  masterId: string;
  accent?: string;
  locale?: string;
}

const UNCATEGORIZED = 'Услуги';

export function ServicesByCategory({ services, masterId, accent = '#7c3aed', locale = 'ru' }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) {
      const cat = s.category?.name?.trim() || UNCATEGORIZED;
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }, [services]);

  const [active, setActive] = useState<string>(groups[0]?.name ?? '');
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function jumpTo(name: string) {
    setActive(name);
    const el = groupRefs.current[name];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  if (groups.length === 0) return null;

  // Один блок без категорий — просто список без pills
  const showPills = groups.length > 1;

  return (
    <div className="space-y-4">
      {showPills && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => {
            const isActive = active === g.name;
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => jumpTo(g.name)}
                className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? accent : 'transparent',
                  color: isActive ? '#fff' : 'rgb(64 64 64)',
                  borderColor: isActive ? accent : 'rgb(229 229 229)',
                }}
              >
                {g.name} <span className={isActive ? 'opacity-70' : 'text-neutral-400'}>({g.items.length})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <div
            key={g.name}
            ref={(el) => {
              groupRefs.current[g.name] = el;
            }}
          >
            {showPills && (
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {g.name}
              </h3>
            )}
            <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
              {g.items.map((s) => (
                <ServiceRow key={s.id} service={s} masterId={masterId} accent={accent} locale={locale} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceRow({ service, masterId, accent, locale }: {
  service: Service;
  masterId: string;
  accent: string;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const hasExtra = service.preparation || service.aftercare || (service.faq && service.faq.length > 0);

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/${locale}/book?master=${masterId}&service=${service.id}`}
          className="block transition-colors hover:opacity-80"
        >
          <div className="text-[15px] font-medium leading-snug">
            {service.name?.trim() || <span className="text-neutral-400">Услуга без названия</span>}
          </div>
          {service.description && (
            <div className="mt-1 text-sm leading-relaxed text-neutral-500">
              {service.description}
            </div>
          )}
          {service.duration_minutes != null && service.duration_minutes > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-neutral-400">
              <Clock className="size-3" /> {service.duration_minutes} мин
            </div>
          )}
        </Link>
        {hasExtra && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-xs font-medium hover:underline"
            style={{ color: accent }}
          >
            {open ? 'Скрыть детали' : 'Подготовка и FAQ'}
          </button>
        )}
        {open && hasExtra && (
          <div
            className="mt-3 space-y-3 rounded-lg border-l-2 pl-3 text-xs text-neutral-700"
            style={{ borderColor: accent }}
          >
            {service.preparation && (
              <div>
                <div className="font-semibold">Как подготовиться</div>
                <div className="whitespace-pre-line">{service.preparation}</div>
              </div>
            )}
            {service.aftercare && (
              <div>
                <div className="font-semibold">Уход после</div>
                <div className="whitespace-pre-line">{service.aftercare}</div>
              </div>
            )}
            {service.faq?.map((f, i) => (
              <div key={i}>
                <div className="font-semibold">{f.q}</div>
                <div>{f.a}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {service.price != null && service.price > 0 && (
          <div className="text-[15px] font-semibold tabular-nums">
            {formatMoney(service.price, service.currency)}
          </div>
        )}
        <Link
          href={`/${locale}/book?master=${masterId}&service=${service.id}`}
          className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition"
          style={{
            borderColor: 'rgb(229 229 229)',
            color: accent,
          }}
        >
          Выбрать
        </Link>
      </div>
    </div>
  );
}
