/** --- YAML
 * name: PublicServicesList
 * description: Fresha-style список услуг для публичной страницы мастера.
 *              Показывает первые 4 услуги; если больше — кнопка «Показать все N»
 *              в правом верхнем углу заголовка открывает bottom-sheet со всеми
 *              услугами (с категорийными pill-табами и возможностью «Записаться»
 *              на любую). Заголовок «Услуги» вынесен внутрь компонента.
 * created: 2026-04-26
 * updated: 2026-05-05
 * --- */

'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatMoney } from '@/lib/format/money';
import { BookingCTA } from './booking/booking-cta';

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
const PREVIEW_LIMIT = 4;

function formatDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

export function PublicServicesList({ services, masterId, locale = 'ru' }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

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

  useEffect(() => {
    if (groups[0]) setActiveTab(groups[0].name);
  }, [groups]);

  if (services.length === 0) return null;

  const preview = services.slice(0, PREVIEW_LIMIT);
  const hasMore = services.length > PREVIEW_LIMIT;
  const showCategoryPills = groups.length > 1;

  function jumpToGroup(name: string) {
    setActiveTab(name);
    const el = groupRefs.current[name];
    if (!el) return;
    const container = el.closest('.all-services-scroll');
    if (!container) return;
    const top = el.offsetTop - 72; // sticky header height
    container.scrollTo({ top, behavior: 'smooth' });
  }

  // Prevent body scroll when popup open
  useEffect(() => {
    if (showAll) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showAll]);

  return (
    <>
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[22px] font-bold" style={{ color: 'var(--m-text)' }}>Услуги</h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[13px] font-semibold"
            style={{ color: 'var(--m-text-secondary)' }}
          >
            Показать все {services.length}
          </button>
        )}
      </div>

      {/* ── Preview — first PREVIEW_LIMIT services ── */}
      <ul
        className="overflow-hidden rounded-[16px] border"
        style={{ background: 'var(--m-surface)', borderColor: 'var(--m-border)' }}
      >
        {preview.map((s, idx) => (
          <li
            key={s.id}
            style={idx > 0 ? { borderTop: '1px solid var(--m-border)' } : undefined}
          >
            <ServiceRow service={s} masterId={masterId} locale={locale} />
          </li>
        ))}
      </ul>

      {/* ── "Show more" bottom link ── */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-[14px] py-3 text-[14px] font-semibold transition-colors"
          style={{
            background: 'var(--m-surface)',
            border: '1px solid var(--m-border)',
            color: 'var(--m-text-secondary)',
          }}
        >
          Ещё {services.length - PREVIEW_LIMIT} услуг
        </button>
      )}

      {/* ── All-services popup ── */}
      <AnimatePresence>
        {showAll && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[200] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAll(false)}
            />

            {/* Sheet */}
            <motion.div
              className="all-services-scroll fixed inset-x-0 bottom-0 z-[201] flex max-h-[88vh] flex-col overflow-y-auto rounded-t-[24px]"
              style={{ background: 'var(--m-bg)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              {/* Sticky header */}
              <div
                className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4"
                style={{
                  background: 'var(--m-bg)',
                  borderColor: 'var(--m-border)',
                }}
              >
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--m-text)' }}>
                  Все услуги · {services.length}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="flex size-8 items-center justify-center rounded-full transition-colors"
                  style={{ background: 'var(--m-bg-subtle)', color: 'var(--m-text)' }}
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Category pill tabs */}
              {showCategoryPills && (
                <div
                  className="-mx-0 flex gap-2 overflow-x-auto border-b px-4 pb-3 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{ borderColor: 'var(--m-border)' }}
                >
                  {groups.map((g) => {
                    const isActive = activeTab === g.name;
                    return (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => jumpToGroup(g.name)}
                        className="whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors"
                        style={{
                          background: isActive ? 'var(--m-text)' : 'var(--m-surface)',
                          color: isActive ? 'var(--m-bg)' : 'var(--m-text-secondary)',
                          borderColor: isActive ? 'var(--m-text)' : 'var(--m-border)',
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* All services grouped */}
              <div className="space-y-8 p-4">
                {groups.map((g) => (
                  <section
                    key={g.name}
                    ref={(el) => { groupRefs.current[g.name] = el; }}
                  >
                    {showCategoryPills && (
                      <h4
                        className="mb-3 text-[15px] font-bold"
                        style={{ color: 'var(--m-text)' }}
                      >
                        {g.name}
                      </h4>
                    )}
                    <ul
                      className="overflow-hidden rounded-[16px] border"
                      style={{ background: 'var(--m-surface)', borderColor: 'var(--m-border)' }}
                    >
                      {g.items.map((s, idx) => (
                        <li
                          key={s.id}
                          style={idx > 0 ? { borderTop: '1px solid var(--m-border)' } : undefined}
                        >
                          <ServiceRow service={s} masterId={masterId} locale={locale} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {/* Bottom safe-area padding */}
                <div className="h-6" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ServiceRow({
  service,
  masterId,
  locale,
}: {
  service: Service;
  masterId: string;
  locale: string;
}) {
  void masterId; void locale;
  const duration = formatDuration(service.duration_minutes);
  const priceStr =
    typeof service.price === 'number' && service.price > 0
      ? formatMoney(service.price, (service.currency || 'UAH').toUpperCase())
      : null;
  const name = service.name?.trim() || 'Услуга';

  return (
    <div className="flex items-start gap-4 px-5 py-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--m-text)' }}>{name}</p>
        {(duration || service.description) && (
          <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--m-text-tertiary)' }}>
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
          <p className="pt-1 text-[15px] font-bold" style={{ color: 'var(--m-text)' }}>{priceStr}</p>
        )}
      </div>
      <BookingCTA variant="service" serviceId={service.id}>Записаться</BookingCTA>
    </div>
  );
}
