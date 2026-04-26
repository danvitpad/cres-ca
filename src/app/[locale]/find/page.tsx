/** --- YAML
 * name: Public marketplace search
 * description: Server-rendered search for masters. Filters by city + service keyword + price cap.
 *              Indexable by Google (no auth required).
 * created: 2026-04-24
 * --- */

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, Search as SearchIcon } from 'lucide-react';
import { searchMasters } from '@/lib/marketplace/search';


interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;      // service keyword
    city?: string;
    price_max?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const parts: string[] = [];
  if (sp.q) parts.push(sp.q);
  if (sp.city) parts.push(sp.city);
  const phrase = parts.length > 0 ? parts.join(' · ') : 'Поиск мастеров';
  const title = `${phrase} · CRES-CA`;
  const description = sp.q || sp.city
    ? `${phrase} — мастера с рейтингом и отзывами. Запись онлайн в 1 клик на CRES-CA.`
    : 'Найдите мастера с рейтингом и отзывами. Маникюр, стрижки, массаж и другие услуги в Украине. Запись онлайн через CRES-CA.';
  return {
    title,
    description,
    alternates: { canonical: `/find${sp.q || sp.city ? `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.city ? { city: sp.city } : {}) })}` : ''}` },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const sp = await searchParams;

  const priceMax = sp.price_max ? Number(sp.price_max) : undefined;
  const results = await searchMasters({
    city: sp.city,
    service: sp.q,
    priceMax: Number.isFinite(priceMax) ? priceMax : undefined,
    limit: 48,
  });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {sp.q || sp.city ? (
            <>
              {sp.q ?? 'Мастера'}
              {sp.city ? <span className="text-neutral-500"> · {sp.city}</span> : null}
            </>
          ) : (
            'Найти мастера'
          )}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {results.length > 0
            ? `Найдено ${results.length} ${results.length === 1 ? 'мастер' : results.length < 5 ? 'мастера' : 'мастеров'}`
            : 'Укажите город или название услуги, чтобы найти мастера.'}
        </p>

        {/* Filter form */}
        <form className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_140px_auto]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Маникюр, стрижка, массаж…"
              className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-500"
            />
          </div>
          <input
            type="text"
            name="city"
            defaultValue={sp.city ?? ''}
            placeholder="Киев"
            className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500"
          />
          <input
            type="number"
            name="price_max"
            defaultValue={sp.price_max ?? ''}
            placeholder="до ₴"
            className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Найти
          </button>
        </form>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((m) => (
            <Link
              key={m.id}
              href={`/m/${m.slug}`}
              className="group rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-violet-400 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                  {m.avatarUrl ? (
                    <Image src={m.avatarUrl} alt={m.fullName} fill className="object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-violet-400 to-pink-400 text-lg font-semibold text-white">
                      {m.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-neutral-900 group-hover:text-violet-700">{m.fullName}</div>
                  {m.specialization && <div className="truncate text-xs text-neutral-500">{m.specialization}</div>}
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                    {m.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {m.city}
                      </span>
                    )}
                    {m.rating !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        <strong>{m.rating.toFixed(1)}</strong>
                        <span className="text-neutral-400">({m.reviewsCount})</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {m.topServices.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {m.topServices.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                      <span className="truncate">{s.name}</span>
                      <span className="shrink-0 font-medium">
                        {s.price} {s.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>

        {results.length === 0 && (sp.q || sp.city) && (
          <div className="mt-12 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <p className="text-sm text-neutral-600">
              Мастеров по запросу не нашли. Попробуйте другой город или название услуги.
            </p>
          </div>
        )}
      </div>
      <p className="sr-only" aria-hidden>Locale: {locale}</p>
    </div>
  );
}
