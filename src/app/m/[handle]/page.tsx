/** --- YAML
 * name: Public Master Showcase
 * description: Публичная страница мастера — server-rendered для SEO. Принимает `handle` = masters.invite_code, тянет карточку (avatar/cover/bio/specialization/city/rating), список активных услуг, Schema.org LocalBusiness JSON-LD. CTA — книга через /book?master=<id>.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, Sparkles, Calendar } from 'lucide-react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { PortfolioGrid } from '@/components/master/portfolio-grid';
import { MasterLikeButton } from '@/components/master/like-button';
import { ShareStoryButton } from '@/components/master/share-story-button';
import { RefCapture } from '@/components/master/ref-capture';

interface PageProps {
  params: Promise<{ handle: string }>;
}

interface MasterRow {
  id: string;
  display_name: string | null;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  rating: number | null;
  total_reviews: number | null;
  avatar_url: string | null;
  cover_url: string | null;
  invite_code: string | null;
  is_active: boolean | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  badges: string[] | null;
  level: number | null;
  likes_count: number | null;
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  duration_minutes: number | null;
  preparation: string | null;
  aftercare: string | null;
  faq: { q: string; a: string }[] | null;
}

interface StoryRow {
  id: string;
  title: string;
  cover_url: string | null;
  photos: string[];
}

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
}

interface ReviewRow {
  id: string;
  score: number;
  comment: string | null;
  photos: string[] | null;
  created_at: string;
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function loadMaster(handle: string): Promise<MasterRow | null> {
  const { data } = await admin()
    .from('masters')
    .select('id, display_name, specialization, bio, city, rating, total_reviews, avatar_url, cover_url, invite_code, is_active, meta_title, meta_description, og_image_url, badges, level, likes_count')
    .eq('invite_code', handle)
    .eq('is_active', true)
    .maybeSingle();
  return (data as MasterRow | null) ?? null;
}

async function loadServices(masterId: string): Promise<ServiceRow[]> {
  const { data } = await admin()
    .from('services')
    .select('id, name, description, price, currency, duration_minutes, preparation, aftercare, faq')
    .eq('master_id', masterId)
    .eq('is_active', true)
    .order('price', { ascending: true });
  return (data as ServiceRow[]) ?? [];
}

async function loadReviews(masterId: string): Promise<ReviewRow[]> {
  const { data } = await admin()
    .from('reviews')
    .select('id, score, comment, photos, created_at')
    .eq('target_type', 'master')
    .eq('target_id', masterId)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data as ReviewRow[]) ?? [];
}

async function loadPortfolio(masterId: string): Promise<PortfolioItem[]> {
  const { data } = await admin()
    .from('master_portfolio')
    .select('id, image_url, caption, tags')
    .eq('master_id', masterId)
    .eq('is_published', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });
  return (data as PortfolioItem[]) ?? [];
}

async function loadStories(masterId: string): Promise<StoryRow[]> {
  const { data } = await admin()
    .from('master_stories')
    .select('id, title, cover_url, photos')
    .eq('master_id', masterId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  return (data as StoryRow[]) ?? [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const master = await loadMaster(handle);
  if (!master) return { title: 'Master not found · CRES-CA' };
  const name = master.display_name ?? 'Master';
  const title =
    master.meta_title ??
    (master.specialization
      ? `${name} — ${master.specialization} · CRES-CA`
      : `${name} · CRES-CA`);
  const description =
    master.meta_description ??
    (master.bio
      ? master.bio.slice(0, 160)
      : `Book ${name}${master.city ? ` in ${master.city}` : ''} online via CRES-CA.`);
  const ogImage = master.og_image_url ?? master.cover_url ?? master.avatar_url ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function MasterShowcasePage({ params }: PageProps) {
  const { handle } = await params;
  const master = await loadMaster(handle);
  if (!master) notFound();

  const [services, stories, portfolio, reviewsList] = await Promise.all([
    loadServices(master.id),
    loadStories(master.id),
    loadPortfolio(master.id),
    loadReviews(master.id),
  ]);
  const displayName = master.display_name ?? 'Master';
  const rating = Number(master.rating ?? 0);
  const reviews = master.total_reviews ?? 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: displayName,
    description: master.bio ?? undefined,
    image: master.avatar_url ?? master.cover_url ?? undefined,
    address: master.city
      ? { '@type': 'PostalAddress', addressLocality: master.city }
      : undefined,
    aggregateRating: reviews > 0
      ? { '@type': 'AggregateRating', ratingValue: rating, reviewCount: reviews }
      : undefined,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/m/${handle}`,
    priceRange: services.length > 0
      ? `${Math.min(...services.map(s => s.price ?? 0))}-${Math.max(...services.map(s => s.price ?? 0))} UAH`
      : undefined,
    makesOffer: services.map(s => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name, description: s.description ?? undefined },
      price: s.price ?? undefined,
      priceCurrency: s.currency ?? 'UAH',
    })),
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <RefCapture />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-600 sm:h-72">
        {master.cover_url && (
          <Image
            src={master.cover_url}
            alt=""
            fill
            priority
            className="object-cover"
          />
        )}
      </div>

      <div className="mx-auto -mt-16 max-w-3xl px-5 sm:-mt-20 sm:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="relative size-28 overflow-hidden rounded-full border-4 border-white bg-neutral-100 shadow-xl sm:size-36">
            {master.avatar_url ? (
              <Image src={master.avatar_url} alt={displayName} fill className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-3xl font-bold text-neutral-400">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:pb-2 sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
            {master.specialization && (
              <p className="mt-1 text-sm text-neutral-600 sm:text-base">{master.specialization}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-neutral-600 sm:justify-start">
              {master.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" /> {master.city}
                </span>
              )}
              {reviews > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <strong>{rating.toFixed(1)}</strong>
                  <span className="text-neutral-400">({reviews})</span>
                </span>
              )}
            </div>
            {(master.badges?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {master.badges!.map((b) => {
                  const labels: Record<string, { emoji: string; text: string; cls: string }> = {
                    verified: { emoji: '✅', text: 'Verified', cls: 'bg-emerald-100 text-emerald-800' },
                    'top-rated': { emoji: '⭐', text: 'Top rated', cls: 'bg-amber-100 text-amber-800' },
                    'top-week': { emoji: '🔥', text: 'Top недели', cls: 'bg-rose-100 text-rose-800' },
                    trending: { emoji: '📈', text: 'Trending', cls: 'bg-violet-100 text-violet-800' },
                    'fast-responder': { emoji: '⚡', text: 'Fast', cls: 'bg-sky-100 text-sky-800' },
                  };
                  const info = labels[b] ?? { emoji: '🏷️', text: b, cls: 'bg-neutral-100 text-neutral-800' };
                  return (
                    <span key={b} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.cls}`}>
                      <span>{info.emoji}</span>
                      {info.text}
                    </span>
                  );
                })}
                {(master.level ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                    Lv {master.level}
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <MasterLikeButton masterId={master.id} initialCount={master.likes_count ?? 0} />
              <ShareStoryButton masterId={master.id} masterName={displayName} />
            </div>
          </div>
        </div>

        {master.bio && (
          <p className="mt-6 text-center text-sm leading-relaxed text-neutral-700 sm:text-left sm:text-base">
            {master.bio}
          </p>
        )}

        <div className="mt-8 flex justify-center sm:justify-start">
          <Link
            href={`/ru/book?master=${master.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-opacity hover:opacity-90"
          >
            <Calendar className="size-4" />
            Book an appointment
          </Link>
        </div>

        {stories.length > 0 && (
          <div className="mt-10 -mx-5 px-5 sm:mx-0 sm:px-0">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {stories.map(story => (
                <a
                  key={story.id}
                  href={`#story-${story.id}`}
                  className="flex shrink-0 flex-col items-center gap-1.5"
                >
                  <div className="size-20 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 p-[3px]">
                    <div className="relative size-full overflow-hidden rounded-full bg-white">
                      {story.cover_url && (
                        <Image src={story.cover_url} alt={story.title} fill className="object-cover" />
                      )}
                    </div>
                  </div>
                  <div className="max-w-[80px] truncate text-center text-xs text-neutral-600">{story.title}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {stories.length > 0 && (
          <div className="mt-12 space-y-10">
            {stories.map(story => (
              <div key={story.id} id={`story-${story.id}`}>
                <h3 className="mb-3 text-lg font-semibold">{story.title}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {story.photos.map((url, i) => (
                    <div key={`${story.id}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
                      <Image src={url} alt="" fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <PortfolioGrid items={portfolio} />

        {reviewsList.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">Отзывы</h2>
            <div className="space-y-4">
              {reviewsList.map(r => (
                <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="mb-1 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i < r.score ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                      />
                    ))}
                    <span className="ml-2 text-xs text-neutral-400">
                      {new Date(r.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{r.comment}</p>
                  )}
                  {r.photos && r.photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {r.photos.map((url, i) => (
                        <div
                          key={`${r.id}-${i}`}
                          className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100"
                        >
                          <Image src={url} alt="" fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {services.length > 0 && (
          <div className="mt-12 mb-16">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="size-5 text-violet-600" />
              Services
            </h2>
            <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
              {services.map(s => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="flex-1">
                    <Link
                      href={`/ru/book?master=${master.id}&service=${s.id}`}
                      className="block hover:text-violet-600"
                    >
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div className="mt-0.5 text-sm text-neutral-500">{s.description}</div>
                      )}
                      {s.duration_minutes && (
                        <div className="mt-1 text-xs text-neutral-400">{s.duration_minutes} min</div>
                      )}
                    </Link>
                    {(s.preparation || s.aftercare || (s.faq && s.faq.length > 0)) && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-violet-600 hover:underline">
                          Как подготовиться и FAQ
                        </summary>
                        <div className="mt-2 space-y-3 border-l-2 border-violet-200 pl-3 text-neutral-700">
                          {s.preparation && (
                            <div>
                              <div className="font-semibold">Как подготовиться</div>
                              <div className="whitespace-pre-line">{s.preparation}</div>
                            </div>
                          )}
                          {s.aftercare && (
                            <div>
                              <div className="font-semibold">Уход после</div>
                              <div className="whitespace-pre-line">{s.aftercare}</div>
                            </div>
                          )}
                          {s.faq && s.faq.length > 0 && (
                            <div className="space-y-2">
                              {s.faq.map((f, i) => (
                                <div key={i}>
                                  <div className="font-semibold">{f.q}</div>
                                  <div>{f.a}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                  {s.price != null && (
                    <div className="text-right">
                      <div className="font-semibold">
                        {s.price} {s.currency ?? 'UAH'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
