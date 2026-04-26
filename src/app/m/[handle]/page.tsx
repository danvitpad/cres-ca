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
import { Star, MapPin, Sparkles, Calendar, Clock, Phone, Mail, Cake } from 'lucide-react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { PortfolioGrid } from '@/components/master/portfolio-grid';
import { ShareStoryButton } from '@/components/master/share-story-button';
import { RefCapture } from '@/components/master/ref-capture';
import { BeforeAfterSlider } from '@/components/shared/before-after-slider';
import { MasterAvatar } from '@/components/master/master-avatar';
import { OwnerToolbar } from '@/components/master/owner-toolbar';
import { OwnerCompletenessPrompt } from '@/components/master/owner-completeness-prompt';
import { FollowMasterButton } from '@/components/master/follow-master-button';
import { MasterPageSectionTabs } from '@/components/master/section-tabs';
import { ServicesByCategory } from '@/components/master/services-by-category';
import { PublicHeroCard } from '@/components/master/public-hero-card';
import { PublicServicesList } from '@/components/master/public-services-list';
import { BookingDrawerProvider } from '@/components/master/booking/booking-provider';
import { BookingCTA } from '@/components/master/booking/booking-cta';
import { InlineCoverBanner } from '@/components/master/inline/cover-banner';
import { InlineBioBlock } from '@/components/master/inline/bio-block';
import { AddressMiniMap } from '@/components/shared/address-mini-map';
import { formatMoney } from '@/lib/format/money';
import { cleanAddress, composeAddress } from '@/lib/format/address';
void ServicesByCategory; // legacy import retained while Fresha rewrite settles

interface PageProps {
  params: Promise<{ handle: string }>;
}

interface MasterRow {
  id: string;
  profile_id: string | null;
  display_name: string | null;
  specialization: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  rating: number | null;
  total_reviews: number | null;
  avatar_url: string | null;
  cover_url: string | null;
  invite_code: string | null;
  slug: string | null;
  is_active: boolean | null;
  is_public: boolean | null;
  headline: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  badges: string[] | null;
  level: number | null;
  working_hours: Record<string, { start: string; end: string; closed?: boolean } | null> | null;
  booking_important_info: string | null;
  // Customization (migration 00104)
  theme_primary_color: string | null;
  theme_background_color: string | null;
  banner_position_y: number | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  phone_public: boolean | null;
  email_public: boolean | null;
  dob_public: boolean | null;
  interests: string[] | null;
  social_links: Record<string, string> | null;
  page_type: string | null;
  // Migration 00114: cached public metrics + languages + workplace
  completed_appointments_count: number;
  served_clients_count: number;
  languages: string[] | null;
  workplace_photo_url: string | null;
  workplace_name: string | null;
  // Salon link (existing)
  salon_id: string | null;
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
  category: { name: string } | null;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
  service_id: string | null;
  service_name: string | null;
}

interface PortfolioRow {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
  service_id: string | null;
  service: { name: string | null } | { name: string | null }[] | null;
}

interface BeforeAfterItem {
  id: string;
  before_url: string;
  after_url: string;
  caption: string | null;
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
  // phone / email / date_of_birth live on `profiles` (PII), not `masters`.
  // Embed them via FK so the public page can render contacts gated by
  // phone_public / email_public / dob_public flags.
  const cols =
    'id, profile_id, display_name, specialization, bio, address, city, rating, total_reviews, avatar_url, cover_url, ' +
    'invite_code, slug, is_active, is_public, headline, meta_title, meta_description, og_image_url, badges, level, working_hours, booking_important_info, ' +
    'theme_primary_color, theme_background_color, banner_position_y, ' +
    'phone_public, email_public, dob_public, interests, social_links, page_type, ' +
    'completed_appointments_count, served_clients_count, languages, workplace_photo_url, workplace_name, salon_id, ' +
    'profile:profiles!masters_profile_id_fkey(phone, email, date_of_birth)';

  const flatten = (row: Record<string, unknown> | null): MasterRow | null => {
    if (!row) return null;
    const profile = (row.profile ?? null) as { phone: string | null; email: string | null; date_of_birth: string | null } | null;
    return {
      ...(row as unknown as Omit<MasterRow, 'phone' | 'email' | 'date_of_birth'>),
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
    } as MasterRow;
  };

  // Try slug first (preferred, SEO-friendly). Require is_public for slug-based visits.
  const bySlug = await admin()
    .from('masters')
    .select(cols)
    .eq('slug', handle)
    .eq('is_active', true)
    .eq('is_public', true)
    .maybeSingle();
  if (bySlug.data) return flatten(bySlug.data as unknown as Record<string, unknown>);

  // Fallback: invite_code (direct link from master, works even without public opt-in)
  const byCode = await admin()
    .from('masters')
    .select(cols)
    .eq('invite_code', handle)
    .eq('is_active', true)
    .maybeSingle();
  return flatten((byCode.data as unknown) as Record<string, unknown> | null);
}

async function loadServices(masterId: string): Promise<ServiceRow[]> {
  const { data } = await admin()
    .from('services')
    .select('id, name, description, price, currency, duration_minutes, preparation, aftercare, faq, category:service_categories(name)')
    .eq('master_id', masterId)
    .eq('is_active', true)
    .order('price', { ascending: true });
  // PostgREST возвращает joined relation как массив; нормализуем в одиночный объект.
  return ((data ?? []) as unknown as Array<Omit<ServiceRow, 'category'> & { category: { name: string }[] | { name: string } | null }>)
    .map((s) => ({
      ...s,
      category: Array.isArray(s.category) ? (s.category[0] ?? null) : s.category,
    }));
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
    .select('id, image_url, caption, tags, service_id, service:services(name)')
    .eq('master_id', masterId)
    .eq('is_published', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });
  const rows = ((data as unknown) as PortfolioRow[] | null) ?? [];
  return rows.map((r) => {
    const svc = Array.isArray(r.service) ? r.service[0] : r.service;
    return {
      id: r.id,
      image_url: r.image_url,
      caption: r.caption,
      tags: r.tags ?? [],
      service_id: r.service_id,
      service_name: svc?.name ?? null,
    };
  });
}

async function loadBeforeAfter(masterId: string): Promise<BeforeAfterItem[]> {
  const { data } = await admin()
    .from('before_after_photos')
    .select('id, before_url, after_url, caption')
    .eq('master_id', masterId)
    .order('created_at', { ascending: false })
    .limit(12);
  return (data as BeforeAfterItem[]) ?? [];
}

interface PartnerRow {
  id: string;
  display_name: string | null;
  specialization: string | null;
  city: string | null;
  avatar_url: string | null;
  invite_code: string | null;
}

async function loadPartners(masterId: string): Promise<PartnerRow[]> {
  // Active partnerships (either direction)
  const { data: rows } = await admin()
    .from('master_partnerships')
    .select('master_id, partner_id')
    .or(`master_id.eq.${masterId},partner_id.eq.${masterId}`)
    .eq('status', 'active');
  if (!rows?.length) return [];

  const otherIds = rows.map(r => r.master_id === masterId ? r.partner_id : r.master_id);
  const { data: partners } = await admin()
    .from('masters')
    .select('id, display_name, specialization, city, avatar_url, invite_code')
    .in('id', otherIds)
    .eq('is_active', true);
  return (partners as PartnerRow[] | null) ?? [];
}

interface SalonInfo {
  id: string;
  name: string | null;
  logo_url: string | null;
  cover_url: string | null;
  city: string | null;
  address: string | null;
}
async function loadSalon(salonId: string | null): Promise<SalonInfo | null> {
  if (!salonId) return null;
  const { data } = await admin()
    .from('salons')
    .select('id, name, logo_url, cover_url, city, address')
    .eq('id', salonId)
    .maybeSingle();
  return (data as SalonInfo | null) ?? null;
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
  // Page-type-aware default copy. Lets us index a clinic page as «Записаться в
  // клинику» rather than the master-only phrasing.
  const ptVerb: Record<string, string> = {
    master:        'Записаться к',
    salon:         'Записаться в',
    clinic:        'Записаться в',
    workshop:      'Заказать в',
    auto_service:  'Записаться в автосервис',
    fitness:       'Записаться в студию',
    other:         'Записаться к',
  };
  const verb = ptVerb[master.page_type ?? 'master'] ?? 'Записаться к';
  const description =
    master.meta_description ??
    master.headline ??
    (master.bio
      ? master.bio.slice(0, 160)
      : `${verb} ${name}${master.city ? ` в городе ${master.city}` : ''} онлайн · CRES-CA`);
  const ogImage = master.og_image_url ?? master.cover_url ?? master.avatar_url ?? undefined;
  const canonicalPath = master.slug ? `/m/${master.slug}` : undefined;
  return {
    title,
    description,
    alternates: canonicalPath ? { canonical: canonicalPath } : undefined,
    robots: master.is_public ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: 'profile',
      url: canonicalPath,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function MasterShowcasePage({ params }: PageProps) {
  const { handle } = await params;
  const master = await loadMaster(handle);
  if (!master) notFound();

  const [services, portfolio, beforeAfter, reviewsList, partners, salon] = await Promise.all([
    loadServices(master.id),
    loadPortfolio(master.id),
    loadBeforeAfter(master.id),
    loadReviews(master.id),
    loadPartners(master.id),
    loadSalon(master.salon_id),
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
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/m/${master.slug ?? handle}`,
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

  const accent = master.theme_primary_color ?? '#0a0a0a';
  const pageBg = master.theme_background_color ?? '#ffffff';
  const bannerY = master.banner_position_y ?? 50;

  // ─── Pre-compute display data ──────────────────────────────────────────
  const hasBio = !!master.bio && master.bio.trim().length > 0;
  const hasServices = services.length > 0;
  const hasPortfolio = portfolio.length > 0 || beforeAfter.length > 0;
  const hasReviews = reviewsList.length > 0;
  const hasPartners = partners.length > 0;
  const hasWorkplace = !!salon || !!master.workplace_name || !!master.workplace_photo_url;

  const workingHoursDays: Array<[string, string]> = [
    ['mon', 'Пн'], ['tue', 'Вт'], ['wed', 'Ср'],
    ['thu', 'Чт'], ['fri', 'Пт'], ['sat', 'Сб'], ['sun', 'Вс'],
  ];
  const hasWorkingHours = !!master.working_hours && workingHoursDays.some(([k]) => {
    const wh = master.working_hours?.[k];
    return wh && !wh.closed && wh.start && wh.end;
  });
  const hasAddress = !!(master.city || master.address || salon?.address);

  const queryStr = (() => {
    const cleanedStreet = cleanAddress(salon?.address ?? master.address);
    return [cleanedStreet, master.city].filter(Boolean).join(', ') || master.city || '';
  })();
  const fullAddress = composeAddress(null, salon?.address ?? master.address, master.city);

  const minPrice = hasServices
    ? Math.min(...services.filter((s) => s.price != null).map((s) => s.price as number))
    : 0;
  const currency = services[0]?.currency ?? 'UAH';

  const bookHref = `/ru/book?master=${master.id}`;

  // Sticky tab nav — show only when there's >1 section to jump to
  const navSections: { id: string; label: string }[] = [];
  if (hasServices) navSections.push({ id: 'services', label: 'Услуги' });
  if (hasPortfolio) navSections.push({ id: 'portfolio', label: 'Работы' });
  if (hasReviews) navSections.push({ id: 'reviews', label: 'Отзывы' });
  if (hasAddress) navSections.push({ id: 'address', label: 'Адрес' });

  return (
    <div
      className="min-h-screen text-neutral-900"
      style={{
        backgroundColor: pageBg,
        ['--page-accent' as string]: accent,
      }}
    >
      <OwnerToolbar masterProfileId={master.profile_id} />
      <RefCapture />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Cover banner — inline-editable для owner. Если cover_url пуст и
          текущий пользователь — owner, показывается dashed-CTA «Добавь обложку».
          Иначе для клиента — image либо ничего. */}
      <InlineCoverBanner
        masterId={master.id}
        masterProfileId={master.profile_id}
        initialCoverUrl={master.cover_url}
        initialBannerY={master.banner_position_y}
      />

      <BookingDrawerProvider
        master={{
          id: master.id,
          displayName,
          specialization: master.specialization,
          avatarUrl: master.avatar_url,
          city: master.city,
          address: master.address,
          workplaceName: salon?.name ?? master.workplace_name,
        }}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          currency: s.currency,
          description: s.description,
          category: s.category,
        }))}
      >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          {/* ─── LEFT col (Hero card) — sticky on desktop, normal on mobile ─── */}
          <div className="lg:col-span-4">
            <PublicHeroCard
              masterId={master.id}
              masterProfileId={master.profile_id}
              displayName={displayName}
              specialization={master.specialization}
              rating={rating}
              reviewsCount={reviews}
              city={master.city}
              avatarUrl={master.avatar_url}
              completedAppointmentsCount={master.completed_appointments_count}
              servedClientsCount={master.served_clients_count}
              languages={master.languages}
              workplaceName={salon?.name ?? master.workplace_name}
              workplaceAddress={fullAddress}
              joinedAt={null}
              bookHref={bookHref}
              accent={accent}
            />
          </div>

          {/* ─── RIGHT col (scroll content) ─── */}
          <div className="space-y-10 lg:col-span-8">
            {/* Owner-only completeness checklist — показывается только владельцу
                страницы, ведёт в нужные разделы для заполнения. Прячется когда
                всё заполнено. Сразу под навигацией, чтобы было заметно. */}
            <OwnerCompletenessPrompt masterProfileId={master.profile_id} />

            {/* Sticky tab nav — only when there's something to navigate to */}
            {navSections.length > 1 && (
              <div className="sticky top-0 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                <nav className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {navSections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-semibold text-neutral-700 hover:bg-neutral-100"
                    >
                      {s.label}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* Bio — inline-editable. Скрыто для клиента если пусто; для owner —
                CTA «Добавь описание». */}
            <InlineBioBlock
              masterId={master.id}
              masterProfileId={master.profile_id}
              initialBio={master.bio}
            />
            {void hasBio /* legacy var, rendering moved to InlineBioBlock */}

            {/* Services */}
            {hasServices && (
              <section id="services" className="scroll-mt-24">
                <h2 className="mb-4 text-[22px] font-bold text-neutral-900">Услуги</h2>
                <PublicServicesList services={services} masterId={master.id} locale="ru" />
              </section>
            )}

            {/* Portfolio */}
            {hasPortfolio && (
              <section id="portfolio" className="scroll-mt-24">
                <h2 className="mb-4 text-[22px] font-bold text-neutral-900">Работы</h2>
                {portfolio.length > 0 && <PortfolioGrid items={portfolio} />}
                {beforeAfter.length > 0 && (
                  <div className={portfolio.length > 0 ? 'mt-6' : ''}>
                    <p className="mb-3 text-sm text-neutral-500">
                      Перетащите разделитель, чтобы сравнить «до» и «после».
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {beforeAfter.map((pair) => (
                        <BeforeAfterSlider
                          key={pair.id}
                          beforeUrl={pair.before_url}
                          afterUrl={pair.after_url}
                          caption={pair.caption}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Reviews */}
            {hasReviews && (
              <section id="reviews" className="scroll-mt-24">
                <div className="mb-4 flex items-baseline gap-2">
                  <h2 className="text-[22px] font-bold text-neutral-900">Отзывы</h2>
                  <span className="text-[14px] text-neutral-500">{reviews}</span>
                </div>
                {reviews > 0 && (
                  <div className="mb-5 flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-5 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                        strokeWidth={0}
                      />
                    ))}
                    <span className="ml-2 text-[15px] font-bold text-neutral-900">{rating.toFixed(1)}</span>
                    <span className="text-[14px] text-neutral-500">({reviews})</span>
                  </div>
                )}
                <ul className="grid gap-4 sm:grid-cols-2">
                  {reviewsList.slice(0, 6).map((r) => (
                    <li
                      key={r.id}
                      className="rounded-2xl border border-neutral-200 bg-white p-5"
                    >
                      <div className="mb-1 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`size-4 ${i < r.score ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                            strokeWidth={0}
                          />
                        ))}
                        <span className="ml-2 text-[12px] text-neutral-500">
                          {new Date(r.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-neutral-800">
                          {r.comment}
                        </p>
                      )}
                      {r.photos && r.photos.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
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
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Address + Hours */}
            {(hasAddress || hasWorkingHours) && (
              <section id="address" className="scroll-mt-24">
                <h2 className="mb-4 text-[22px] font-bold text-neutral-900">Адрес и часы работы</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {hasAddress && (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                      {queryStr && <AddressMiniMap query={queryStr} className="h-48 w-full" />}
                      <div className="flex items-start gap-3 p-5">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                          <MapPin className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-neutral-900">
                            {salon?.name ?? master.workplace_name ?? 'Адрес'}
                          </p>
                          {fullAddress && (
                            <p className="mt-0.5 text-[14px] text-neutral-600">{fullAddress}</p>
                          )}
                          {queryStr && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-neutral-900 hover:underline"
                            >
                              Проложить маршрут →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {hasWorkingHours && (
                    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                          <Clock className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-neutral-900">Часы работы</p>
                          <ul className="mt-2 space-y-1.5 text-[13px]">
                            {workingHoursDays.map(([key, label]) => {
                              const wh = master.working_hours?.[key];
                              const isOpen = wh && !wh.closed && wh.start && wh.end;
                              return (
                                <li key={key} className="flex items-center justify-between">
                                  <span className="text-neutral-500">{label}</span>
                                  <span className={isOpen ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
                                    {isOpen ? `${wh.start} – ${wh.end}` : 'Выходной'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {master.booking_important_info && master.booking_important_info.trim().length > 0 && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Phone className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-amber-900">Важная информация</p>
                        <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-amber-900/80">
                          {master.booking_important_info}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Workplace photos (только если есть отдельные фото — иначе уже в карте) */}
            {hasWorkplace && (salon?.cover_url || master.workplace_photo_url) && (
              <section id="workplace">
                <h2 className="mb-4 text-[22px] font-bold text-neutral-900">Где принимаю</h2>
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="relative h-48 w-full bg-neutral-100 sm:h-64">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(salon?.cover_url ?? master.workplace_photo_url) as string}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Partners */}
            {hasPartners && (
              <section id="partners">
                <h2 className="mb-2 text-[22px] font-bold text-neutral-900">Рекомендую</h2>
                <p className="mb-4 text-[14px] text-neutral-500">Мастера, с которыми я работаю и доверяю.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {partners.map((p) => (
                    <Link
                      key={p.id}
                      href={p.invite_code ? `/m/${p.invite_code}` : '#'}
                      className="group flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-center transition hover:border-neutral-300 hover:shadow-sm"
                    >
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt={p.display_name || ''} className="size-16 rounded-full object-cover" />
                      ) : (
                        <div className="flex size-16 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-600">
                          {(p.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-[14px] font-semibold leading-tight text-neutral-900">
                        {p.display_name || 'Мастер'}
                      </div>
                      {p.specialization && (
                        <div className="text-[12px] text-neutral-500">{p.specialization}</div>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom CTA — visible while scrolling on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur p-3 lg:hidden">
        <BookingCTA variant="sticky">
          Записаться{hasServices && ` · от ${formatMoney(minPrice, currency)}`}
        </BookingCTA>
      </div>
      <div className="h-20 lg:hidden" />
      </BookingDrawerProvider>
    </div>
  );
}
