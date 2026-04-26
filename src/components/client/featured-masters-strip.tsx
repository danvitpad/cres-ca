/** --- YAML
 * name: FeaturedMastersStrip
 * description: Discovery-карусель «Топ мастеров» для пустого клиентского фида.
 *              Тянет /api/marketplace/featured (опц. ?city=). Fresha-style:
 *              горизонтальный скролл с большими карточками — imageBg, имя,
 *              специализация, рейтинг, цена «от».
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { formatMoney } from '@/lib/format/money';

interface MasterCard {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  city: string | null;
  specialization: string | null;
  rating: number | null;
  reviewsCount: number;
  topServices: Array<{ name: string; price: number; currency: string }>;
}

export function FeaturedMastersStrip({ city }: { city?: string }) {
  const [items, setItems] = useState<MasterCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const qs = new URLSearchParams();
      if (city) qs.set('city', city);
      qs.set('limit', '12');
      try {
        const r = await fetch(`/api/marketplace/featured?${qs.toString()}`);
        const j = await r.json();
        if (!cancelled) {
          setItems(Array.isArray(j.items) ? j.items : []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [city]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-56 w-[220px] shrink-0 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-semibold">
          Топ мастеров{city ? ` · ${city}` : ''}
        </h2>
        <Link href="/search" className="text-xs font-semibold text-violet-600 hover:underline">
          Смотреть все →
        </Link>
      </div>
      <div className="mt-3 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((m) => {
          const cheapest = m.topServices[0];
          return (
            <Link
              key={m.id}
              href={`/m/${m.slug}`}
              className="group flex w-[220px] shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt={m.fullName}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-4xl font-semibold text-neutral-300">
                    {m.firstName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
                {(m.rating ?? 0) > 0 && (
                  <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold backdrop-blur dark:bg-neutral-900/85">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {m.rating?.toFixed(1)}
                    <span className="text-neutral-400">({m.reviewsCount})</span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="truncate text-sm font-semibold">{m.fullName}</p>
                {m.specialization && (
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{m.specialization}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  {m.city && (
                    <span className="truncate text-[11px] text-neutral-400">{m.city}</span>
                  )}
                  {cheapest && (
                    <span className="text-xs font-semibold tabular-nums">
                      от {formatMoney(cheapest.price, cheapest.currency)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
