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
import { AddressMiniMap } from '@/components/shared/address-mini-map';
import { formatMoney } from '@/lib/format/money';
import { cleanAddress, composeAddress } from '@/lib/format/address';

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

  const accent = master.theme_primary_color ?? '#7c3aed';
  const pageBg = master.theme_background_color ?? '#ffffff';
  const bannerY = master.banner_position_y ?? 50;

  return (
    <div
      className="min-h-screen text-neutral-900"
      style={{
        backgroundColor: pageBg,
        // Page-level CSS var any descendant can read for buttons/badges/links.
        ['--page-accent' as string]: accent,
      }}
    >
      <OwnerToolbar masterProfileId={master.profile_id} />
      <RefCapture />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div
        className="relative h-56 w-full overflow-hidden sm:h-80 lg:h-[420px]"
        style={
          master.cover_url
            ? undefined
            : { background: `linear-gradient(135deg, ${accent}, ${accent}99)` }
        }
      >
        {master.cover_url && (
          <Image
            src={master.cover_url}
            alt=""
            fill
            priority
            className="object-cover"
            style={{ objectPosition: `center ${bannerY}%` }}
          />
        )}
        {/* Subtle vignette so light text remains readable on bright covers */}
        {master.cover_url && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        )}
      </div>

      <div className="mx-auto -mt-16 max-w-6xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-full border-4 border-white bg-neutral-100 shadow-xl sm:size-36">
            <MasterAvatar url={master.avatar_url} name={displayName} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
            {master.specialization && (
              <p className="mt-1 text-sm text-neutral-600 sm:text-base">{master.specialization}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-neutral-600 sm:justify-start">
              {reviews > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <strong>{rating.toFixed(1)}</strong>
                  <span className="text-neutral-400">({reviews})</span>
                </span>
              )}
              {master.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" /> {master.city}
                </span>
              )}
            </div>

            {/* Public stats — completed visits + served clients (cached counters
                from migration 00114). Hidden when both are zero (new master). */}
            {(master.completed_appointments_count > 0 || master.served_clients_count > 0) && (
              <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-neutral-600 sm:justify-start">
                <span>
                  Завершённые записи{' '}
                  <strong className="tabular-nums text-neutral-900">{master.completed_appointments_count.toLocaleString('ru-RU')}</strong>
                </span>
                <span>
                  Обслужено клиентов{' '}
                  <strong className="tabular-nums text-neutral-900">{master.served_clients_count.toLocaleString('ru-RU')}</strong>
                </span>
              </div>
            )}

            {/* Languages */}
            {(master.languages?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {master.languages!.map((lang) => (
                  <span key={lang} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700">
                    {lang}
                  </span>
                ))}
              </div>
            )}
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
              <ShareStoryButton masterId={master.id} masterName={displayName} />
            </div>
          </div>
        </div>

        {master.bio && (
          <p className="mt-6 text-center text-sm leading-relaxed text-neutral-700 sm:text-left sm:text-base">
            {master.bio}
          </p>
        )}

        {/* Owner-only completeness checklist — shows what's missing on the page,
            with deep-links to fill each gap. Hides automatically when 100% complete. */}
        <OwnerCompletenessPrompt masterProfileId={master.profile_id} />

        {/* Mobile-only CTA right under hero. Desktop has its own sticky CTA in the right column. */}
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start lg:hidden">
          <Link
            href={`/ru/book?master=${master.id}`}
            className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            <Calendar className="size-4" />
            Записаться
          </Link>
          <FollowMasterButton masterId={master.id} accent={accent} />
        </div>

        {/* Sticky section nav — Fresha-style. Только показываем если есть хоть один таб контента. */}
        {(() => {
          const navSections: { id: string; label: string }[] = [];
          if (services.length > 0) navSections.push({ id: 'services', label: 'Услуги' });
          if (portfolio.length > 0 || beforeAfter.length > 0) navSections.push({ id: 'portfolio', label: 'Работы' });
          if (reviewsList.length > 0) navSections.push({ id: 'reviews', label: 'Отзывы' });
          if (partners.length > 0) navSections.push({ id: 'partners', label: 'Рекомендую' });
          if (master.city || master.address || salon || master.workplace_name) {
            navSections.push({ id: 'contacts', label: 'Контакты' });
          }
          return navSections.length > 1 ? (
            <MasterPageSectionTabs sections={navSections} accent={accent} />
          ) : null;
        })()}

        {/* Two-column layout — Fresha-style: full content on left, sticky booking summary on right */}
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0 space-y-12">

        {/* Contacts + socials + interests — all gated on per-field public flags */}
        {(((master.phone && master.phone_public) ||
           (master.email && master.email_public) ||
           (master.date_of_birth && master.dob_public) ||
           Object.keys(master.social_links ?? {}).length > 0 ||
           (master.interests?.length ?? 0) > 0)) && (
          <div className="mt-8 space-y-3">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-700">
              {master.phone && master.phone_public && (
                <a href={`tel:${master.phone}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: accent }}>
                  <Phone className="size-4" />
                  {master.phone}
                </a>
              )}
              {master.email && master.email_public && (
                <a href={`mailto:${master.email}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: accent }}>
                  <Mail className="size-4" />
                  {master.email}
                </a>
              )}
              {master.date_of_birth && master.dob_public && (
                <span className="inline-flex items-center gap-1.5 text-neutral-600">
                  <Cake className="size-4" />
                  {new Date(master.date_of_birth).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}
                </span>
              )}
            </div>

            {Object.keys(master.social_links ?? {}).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(master.social_links ?? {}).map(([key, value]) => {
                  if (!value) return null;
                  let href = value;
                  if (key === 'telegram' && !href.startsWith('http')) href = `https://t.me/${href.replace(/^@/, '')}`;
                  else if (key === 'instagram' && !href.startsWith('http')) href = `https://instagram.com/${href.replace(/^@/, '')}`;
                  else if (key === 'tiktok' && !href.startsWith('http')) href = `https://tiktok.com/@${href.replace(/^@/, '')}`;
                  else if (key === 'whatsapp' && !href.startsWith('http')) href = `https://wa.me/${href.replace(/[^\d]/g, '')}`;
                  else if (key === 'viber' && !href.startsWith('http')) href = `viber://chat?number=${encodeURIComponent(href)}`;
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      {key === 'telegram' && '💬'}
                      {key === 'instagram' && '📸'}
                      {key === 'whatsapp' && '🟢'}
                      {key === 'viber' && '🟣'}
                      {key === 'tiktok' && '🎵'}
                      {key === 'youtube' && '📺'}
                      {key === 'website' && '🌐'}
                      <span className="capitalize">{key}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {(master.interests?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {master.interests!.map((tag) => (
                  <span key={tag} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-700">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {services.length > 0 && (
          <div id="services" className="scroll-mt-20">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="size-5" style={{ color: accent }} />
              Услуги
            </h2>
            <ServicesByCategory services={services} masterId={master.id} accent={accent} locale="ru" />
          </div>
        )}

        {(portfolio.length > 0 || beforeAfter.length > 0) && (
          <div id="portfolio" className="scroll-mt-20">
            <PortfolioGrid items={portfolio} />
          </div>
        )}

        {/* ─── До / После — интерактивные слайдеры ─── */}
        {beforeAfter.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-1 text-xl font-semibold">До и после</h2>
            <p className="mb-4 text-sm text-neutral-500">Перетащите разделитель, чтобы сравнить результат.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {beforeAfter.map((pair) => (
                <div key={pair.id}>
                  <BeforeAfterSlider
                    beforeUrl={pair.before_url}
                    afterUrl={pair.after_url}
                    caption={pair.caption}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Рекомендую — partners ─── */}
        {partners.length > 0 && (
          <div id="partners" className="mt-12 scroll-mt-20">
            <h2 className="mb-4 text-xl font-semibold">Рекомендую</h2>
            <p className="mb-4 text-sm text-neutral-500">Мастера, с которыми я работаю и доверяю.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {partners.map(p => (
                <Link
                  key={p.id}
                  href={p.invite_code ? `/m/${p.invite_code}` : '#'}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-center transition hover:border-violet-400 hover:shadow"
                >
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.display_name || ''}
                      className="size-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-lg font-semibold text-white">
                      {(p.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-sm font-semibold leading-tight text-neutral-800 group-hover:text-violet-700">
                    {p.display_name || 'Мастер'}
                  </div>
                  {p.specialization && (
                    <div className="text-xs text-neutral-500">{p.specialization}</div>
                  )}
                  {p.city && (
                    <div className="text-xs text-neutral-400">{p.city}</div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {reviewsList.length > 0 && (
          <div id="reviews" className="mt-12 scroll-mt-20">
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

        {/* «Работает в» — салон или собственный кабинет */}
        {(salon || master.workplace_name || master.workplace_photo_url) && (
          <div id="workplace" className="mt-12 scroll-mt-20">
            <h2 className="mb-4 text-xl font-semibold">Где принимаю</h2>
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {(salon?.cover_url || master.workplace_photo_url) && (
                <div className="relative h-40 w-full overflow-hidden bg-neutral-100 sm:h-56">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(salon?.cover_url ?? master.workplace_photo_url) as string}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-start gap-3 p-5">
                {salon?.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={salon.logo_url}
                    alt=""
                    className="size-12 rounded-full border border-neutral-200 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900">
                    {salon?.name ?? master.workplace_name ?? 'Собственный кабинет'}
                  </p>
                  {(() => {
                    const addr = composeAddress(null, salon?.address ?? master.address, master.city);
                    return addr ? <p className="mt-0.5 text-sm text-neutral-600">{addr}</p> : null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {(master.city || master.working_hours) && (
          <div id="contacts" className="mt-12 mb-16 scroll-mt-20">
            <h2 className="mb-4 text-xl font-semibold">Контакты и часы работы</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {(master.city || master.address || salon?.address) && (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  {/* OpenStreetMap iframe — бесплатный embed, без API-ключей.
                      Bbox считается из города; если есть точный адрес — используем его. */}
                  {(() => {
                    const cleanedStreet = cleanAddress(salon?.address ?? master.address);
                    const fullDisplay = composeAddress(null, salon?.address ?? master.address, master.city);
                    const queryStr = [cleanedStreet, master.city].filter(Boolean).join(', ') || master.city || '';
                    const q = encodeURIComponent(queryStr);
                    if (!queryStr && !fullDisplay) return null;
                    return (
                      <>
                        {queryStr && (
                          <AddressMiniMap query={queryStr} className="h-48 w-full" />
                        )}
                        <div className="flex items-start gap-3 p-5">
                          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                            <MapPin className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">Адрес</p>
                            {fullDisplay && (
                              <p className="mt-0.5 text-sm text-neutral-600">{fullDisplay}</p>
                            )}
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${q || encodeURIComponent(master.city || '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
                            >
                              Открыть в Google Maps →
                            </a>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              {master.working_hours && (() => {
                const days: Array<[string, string]> = [
                  ['mon', 'Пн'], ['tue', 'Вт'], ['wed', 'Ср'],
                  ['thu', 'Чт'], ['fri', 'Пт'], ['sat', 'Сб'], ['sun', 'Вс'],
                ];
                const anyOpen = days.some(([k]) => {
                  const wh = master.working_hours?.[k];
                  return wh && !wh.closed && wh.start && wh.end;
                });
                if (!anyOpen) return null;
                return (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                        <Clock className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Часы работы</p>
                        <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                          {days.map(([key, label]) => {
                            const wh = master.working_hours?.[key];
                            const isOpen = wh && !wh.closed && wh.start && wh.end;
                            return (
                              <li key={key} className="flex justify-between gap-3">
                                <span className="text-neutral-500">{label}</span>
                                <span className={isOpen ? 'font-medium text-neutral-800' : 'text-neutral-400'}>
                                  {isOpen ? `${wh.start}–${wh.end}` : 'Выходной'}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            {master.booking_important_info && master.booking_important_info.trim().length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Phone className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-900">Важная информация</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-900/80">
                      {master.booking_important_info}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
          </div>
          {/* ─── Right column: sticky booking summary — desktop only ─── */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Запись онлайн
              </div>
              {services.length > 0 && (() => {
                const minPrice = Math.min(...services.filter(s => s.price != null).map(s => s.price as number));
                const cur = services[0]?.currency ?? 'UAH';
                return (
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xs text-neutral-500">от</span>
                    <span className="text-2xl font-bold text-neutral-900">{formatMoney(minPrice, cur)}</span>
                  </div>
                );
              })()}
              {reviews > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <strong className="text-neutral-900">{rating.toFixed(1)}</strong>
                  <span className="text-neutral-400">· {reviews} отзывов</span>
                </div>
              )}
              <Link
                href={`/ru/book?master=${master.id}`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                <Calendar className="size-4" />
                Записаться
              </Link>
              <div className="mt-2">
                <FollowMasterButton masterId={master.id} accent={accent} />
              </div>
              {master.city && (
                <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                  <MapPin className="size-3.5" />
                  {master.city}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky bottom CTA — visible while scrolling on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur p-3 lg:hidden">
        <Link
          href={`/ru/book?master=${master.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <Calendar className="size-4" />
          Записаться
        </Link>
      </div>
      {/* spacer so content above isn't covered by the mobile sticky bar */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
