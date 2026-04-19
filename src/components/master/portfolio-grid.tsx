/** --- YAML
 * name: PortfolioGrid
 * description: Клиентский компонент для публичной витрины мастера — показывает фото портфолио с фильтром по тегу/услуге
 *              и fullscreen просмотром (стрелки / клик вне / ESC). Touch-friendly, без зависимостей.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
  service_id?: string | null;
  service_name?: string | null;
}

export function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const allServices = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => {
      if (i.service_id && i.service_name) map.set(i.service_id, i.service_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) => {
      if (activeTag && !i.tags.includes(activeTag)) return false;
      if (activeService && i.service_id !== activeService) return false;
      return true;
    }),
    [items, activeTag, activeService],
  );

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => {
    setLightboxIdx((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));
  }, [filtered.length]);
  const next = useCallback(() => {
    setLightboxIdx((i) => (i === null ? null : (i + 1) % filtered.length));
  }, [filtered.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIdx, closeLightbox, prev, next]);

  if (items.length === 0) return null;

  const active = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  return (
    <div className="mt-12">
      <h2 className="mb-4 text-xl font-semibold">Портфолио</h2>

      {allServices.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveService(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeService === null
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Все услуги
          </button>
          {allServices.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveService(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeService === s.id
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              activeTag === null
                ? 'bg-violet-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            все теги
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                activeTag === tag
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((item, idx) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setLightboxIdx(idx)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <Image
              src={item.image_url}
              alt={item.caption ?? ''}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
            {item.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.caption}
              </div>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Ничего не найдено для выбранных фильтров.</p>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            aria-label="Закрыть"
            onClick={closeLightbox}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          {filtered.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Предыдущее"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Следующее"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.image_url}
              alt={active.caption ?? ''}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            />
            {(active.caption || active.service_name) && (
              <div className="mt-3 text-center">
                {active.service_name && (
                  <div className="mb-1 text-xs uppercase tracking-wider text-white/60">
                    {active.service_name}
                  </div>
                )}
                {active.caption && <div className="text-sm text-white">{active.caption}</div>}
                {active.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {active.tags.map((t) => (
                      <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {filtered.length > 1 && (
              <div className="mt-2 text-center text-xs text-white/50">
                {lightboxIdx! + 1} / {filtered.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
