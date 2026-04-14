/** --- YAML
 * name: PortfolioGrid
 * description: Клиентский компонент для публичной витрины мастера — показывает фото портфолио с фильтром по тегам.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
}

export function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (activeTag ? items.filter((i) => i.tags.includes(activeTag)) : items),
    [items, activeTag],
  );

  if (items.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="mb-4 text-xl font-semibold">Портфолио</h2>
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
            все
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
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-100"
          >
            <Image
              src={item.image_url}
              alt={item.caption ?? ''}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
            {item.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
