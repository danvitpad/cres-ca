/** --- YAML
 * name: Public Master Showcase
 * description: Публичная страница мастера — server-rendered для SEO. Принимает `handle` = masters.invite_code, тянет карточку (avatar/cover/bio/specialization/city/rating), список активных услуг, Schema.org LocalBusiness JSON-LD. CTA — книга через /book?master=<id>.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { Star, MapPin, Calendar, Clock, Phone, Mail, Cake } from 'lucide-react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { RefCapture } from '@/components/master/ref-capture';
import { PartnerRefCapture } from '@/components/master/partner-ref-capture';
import { BeforeAfterSlider } from '@/components/shared/before-after-slider';
import { MasterAvatar } from '@/components/master/master-avatar';
import { MiniAppBackBar } from '@/components/master/mini-app-back-bar';
import { normalizeWorkingHours } from '@/lib/working-hours/normalize';
import { PublicBackButton } from '@/components/master/public-back-button';
import { OwnerCompletenessPrompt } from '@/components/master/owner-completeness-prompt';
import { OwnerHiddenCTAs } from '@/components/master/owner-hidden-ctas';
import { MiniAppBottomPad } from '@/components/master/mini-app-bottom-pad';
import { MasterPageSectionTabs } from '@/components/master/section-tabs';
import { ServicesByCategory } from '@/components/master/services-by-category';
import { PublicHeroCard } from '@/components/master/public-hero-card';
import { PublicCresIdBadge } from '@/components/master/public-cres-id';
import { PublicServicesList } from '@/components/master/public-services-list';
import { PublicReviewsList } from '@/components/master/public-reviews-list';
import { BookingDrawerProvider } from '@/components/master/booking/booking-provider';
import { BookingCTA } from '@/components/master/booking/booking-cta';
import { InlineCoverBanner } from '@/components/master/inline/cover-banner';
import { InlineBioBlock } from '@/components/master/inline/bio-block';
import { InlineHoursBlock } from '@/components/master/inline/hours-block';
import { InlineAddressBlock } from '@/components/master/inline/address-block';
import { InlineSocialBlock } from '@/components/master/inline/social-block';
import { InlineInterestsBlock } from '@/components/master/inline/interests-block';
import { OwnerInlineQuickSettings } from '@/components/master/inline/quick-settings-panel';
import { OwnerPortfolioPanel } from '@/components/master/inline/owner-portfolio-panel';
import { AddressMiniMap } from '@/components/shared/address-mini-map';
import { formatMoney } from '@/lib/format/money';
import { cleanAddress, composeAddress } from '@/lib/format/address';
void ServicesByCategory; // legacy import retained while Fresha rewrite settles

interface PageProps {
  params: Promise<{ handle: string }>;
}

type Lang = 'uk' | 'ru' | 'en';

async function getServerLocale(isOwner: boolean): Promise<Lang> {
  // Правило 2026-05-06: публичная страница мастера всем посетителям
  // показывается ТОЛЬКО на украинском. В других языках её видит лишь сам
  // владелец (когда залогинен и зашёл на свою страницу) — тогда учитываются
  // его cookie/accept-language.
  if (!isOwner) return 'uk';
  try {
    const c = await cookies();
    const fromCookie = c.get('NEXT_LOCALE')?.value;
    if (fromCookie === 'uk' || fromCookie === 'ru' || fromCookie === 'en') return fromCookie;
  } catch {}
  try {
    const h = await headers();
    const al = (h.get('accept-language') ?? '').toLowerCase();
    if (al.startsWith('uk')) return 'uk';
    if (al.startsWith('ru')) return 'ru';
    if (al.startsWith('en')) return 'en';
  } catch {}
  return 'uk';
}

async function isViewerOwner(masterProfileId: string | null): Promise<boolean> {
  if (!masterProfileId) return false;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user && user.id === masterProfileId;
  } catch {
    return false;
  }
}

const STR: Record<Lang, {
  bookVerb: Record<string, string>;
  inCity: (c: string) => string;
  masterFallback: string;
  ratingDateLocale: string;
  navServices: string; navPortfolio: string; navReviews: string; navAddress: string;
  reviewsHeading: string;
  beforeAfterHint: string;
  addressAndHours: string; hoursOnly: string;
  importantInfo: string;
  workplace: string;
  partners: string; partnersDesc: string;
  bookCta: string; from: string;
  anonymousLabel: string;
  showAllReviews: string; collapseReviews: string;
}> = {
  uk: {
    bookVerb: {
      master: 'Записатися до', salon: 'Записатися в', clinic: 'Записатися в',
      workshop: 'Замовити в', auto_service: 'Записатися в автосервіс',
      fitness: 'Записатися в студію', other: 'Записатися до',
    },
    inCity: (c) => ` у місті ${c}`,
    masterFallback: 'Майстер',
    ratingDateLocale: 'uk-UA',
    navServices: 'Послуги', navPortfolio: 'Роботи', navReviews: 'Відгуки', navAddress: 'Адреса',
    reviewsHeading: 'Відгуки',
    beforeAfterHint: 'Перетягніть роздільник, щоб порівняти «до» і «після».',
    addressAndHours: 'Адреса та години роботи', hoursOnly: 'Години роботи',
    importantInfo: 'Важлива інформація',
    workplace: 'Де приймаю',
    partners: 'Рекомендую', partnersDesc: 'Майстри, з якими я працюю і кому довіряю.',
    bookCta: 'Записатися', from: 'від',
    anonymousLabel: 'Анонімний клієнт',
    showAllReviews: 'Показати всі відгуки', collapseReviews: 'Згорнути',
  },
  ru: {
    bookVerb: {
      master: 'Записаться к', salon: 'Записаться в', clinic: 'Записаться в',
      workshop: 'Заказать в', auto_service: 'Записаться в автосервис',
      fitness: 'Записаться в студию', other: 'Записаться к',
    },
    inCity: (c) => ` в городе ${c}`,
    masterFallback: 'Мастер',
    ratingDateLocale: 'ru-RU',
    navServices: 'Услуги', navPortfolio: 'Работы', navReviews: 'Отзывы', navAddress: 'Адрес',
    reviewsHeading: 'Отзывы',
    beforeAfterHint: 'Перетащите разделитель, чтобы сравнить «до» и «после».',
    addressAndHours: 'Адрес и часы работы', hoursOnly: 'Часы работы',
    importantInfo: 'Важная информация',
    workplace: 'Где принимаю',
    partners: 'Рекомендую', partnersDesc: 'Мастера, с которыми я работаю и доверяю.',
    bookCta: 'Записаться', from: 'от',
    anonymousLabel: 'Анонимный клиент',
    showAllReviews: 'Показать все отзывы', collapseReviews: 'Свернуть',
  },
  en: {
    bookVerb: {
      master: 'Book with', salon: 'Book at', clinic: 'Book at',
      workshop: 'Order at', auto_service: 'Book auto service',
      fitness: 'Book studio', other: 'Book with',
    },
    inCity: (c) => ` in ${c}`,
    masterFallback: 'Master',
    ratingDateLocale: 'en-US',
    navServices: 'Services', navPortfolio: 'Portfolio', navReviews: 'Reviews', navAddress: 'Address',
    reviewsHeading: 'Reviews',
    beforeAfterHint: 'Drag the divider to compare “before” and “after”.',
    addressAndHours: 'Address and hours', hoursOnly: 'Hours',
    importantInfo: 'Important info',
    workplace: 'Where I work',
    partners: 'Recommended', partnersDesc: 'Masters I work with and trust.',
    bookCta: 'Book', from: 'from',
    anonymousLabel: 'Anonymous client',
    showAllReviews: 'Show all reviews', collapseReviews: 'Collapse',
  },
};

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
  working_hours: unknown; // multi-interval JSONB; нормализуется через normalizeWorkingHours
  booking_important_info: string | null;
  // Customization (migration 00104)
  theme_primary_color: string | null;
  theme_background_color: string | null;
  theme_background_image_url: string | null;
  banner_position_y: number | null;
  banner_position_x: number | null;
  banner_scale: number | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  phone_public: boolean | null;
  email_public: boolean | null;
  dob_public: boolean | null;
  interests: string[] | null;
  social_links: Record<string, string> | null;
  page_type: string | null;
  works_online: boolean | null;
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
  item_x: number | null;
  item_y: number | null;
  item_scale: number | null;
}

interface PortfolioRow {
  id: string;
  image_url: string;
  caption: string | null;
  tags: string[];
  service_id: string | null;
  service: { name: string | null } | { name: string | null }[] | null;
  item_x: number | null;
  item_y: number | null;
  item_scale: number | null;
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
  is_anonymous: boolean;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
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
    'theme_primary_color, theme_background_color, theme_background_image_url, banner_position_y, banner_position_x, banner_scale, ' +
    'phone_public, email_public, dob_public, interests, social_links, page_type, works_online, ' +
    'completed_appointments_count, served_clients_count, languages, workplace_photo_url, workplace_name, salon_id, ' +
    'profile:profiles!masters_profile_id_fkey(full_name, first_name, last_name, phone, email, date_of_birth, deleted_at)';

  const flatten = (row: Record<string, unknown> | null): MasterRow | null => {
    if (!row) return null;
    const profile = (row.profile ?? null) as { full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; email: string | null; date_of_birth: string | null; deleted_at: string | null } | null;
    // Если аккаунт мастера помечен на удаление — публичная страница недоступна.
    if (profile?.deleted_at) return null;
    // Имя мастера: display_name (если задано отдельно для публички) → first+last → full_name из профиля.
    const fromParts = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || null;
    const masterRow = row as unknown as MasterRow & { display_name: string | null };
    if (!masterRow.display_name) {
      masterRow.display_name = fromParts || profile?.full_name || null;
    }
    return {
      ...(masterRow as unknown as Omit<MasterRow, 'phone' | 'email' | 'date_of_birth'>),
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
    } as MasterRow;
  };

  // Try slug first (preferred, SEO-friendly). Non-public pages are still
  // accessible via direct link — they simply get noindex robots tag.
  const bySlug = await admin()
    .from('masters')
    .select(cols)
    .eq('slug', handle)
    .eq('is_active', true)
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
    .select('id, score, comment, photos, created_at, is_anonymous, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)')
    .eq('target_type', 'master')
    .eq('target_id', masterId)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data as unknown as ReviewRow[]) ?? [];
}

async function loadPortfolio(masterId: string): Promise<PortfolioItem[]> {
  const { data } = await admin()
    .from('master_portfolio')
    .select('id, image_url, caption, tags, service_id, service:services(name), item_x, item_y, item_scale')
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
      item_x: r.item_x,
      item_y: r.item_y,
      item_scale: r.item_scale,
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
  // Active partnerships (either direction). Сортировка по display_order ASC
  // (для подписки tier 3+) с фолбэком на accepted_at DESC — чтобы недавние
  // партнёрства показывались первыми когда display_order не задан.
  const { data: rows } = await admin()
    .from('master_partnerships')
    .select('master_id, partner_id, display_order, accepted_at')
    .or(`master_id.eq.${masterId},partner_id.eq.${masterId}`)
    .eq('status', 'active')
    .order('display_order', { ascending: true })
    .order('accepted_at', { ascending: false });
  if (!rows?.length) return [];

  const otherIds = rows.map(r => r.master_id === masterId ? r.partner_id : r.master_id);
  const { data: partners } = await admin()
    .from('masters')
    .select('id, display_name, specialization, city, avatar_url, invite_code')
    .in('id', otherIds)
    .eq('is_active', true);
  if (!partners) return [];
  // Сохраняем порядок rows (по display_order/accepted_at), а partners пришли
  // через `.in()` без гарантии порядка. Восстанавливаем по otherIds.
  const byId = new Map((partners as PartnerRow[]).map((p) => [p.id, p]));
  return otherIds.map((id) => byId.get(id)).filter((x): x is PartnerRow => !!x);
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

/** Если открытый мастер сам ВЛАДЕЕТ салоном — этот мастер представляет
 *  команду. Подтягиваем salon, vertical, имя/тел/email менеджера-владельца
 *  + список других мастеров команды для блока «Команда салона».
 */
interface OwnedSalonContext {
  salon: { id: string; name: string | null; vertical: string | null; phone: string | null; email: string | null };
  manager: { full_name: string | null; phone: string | null; email: string | null };
  members: Array<{ id: string; slug: string | null; display_name: string | null; specialization: string | null; avatar_url: string | null }>;
}
async function loadOwnedSalonContext(profileId: string | null): Promise<OwnedSalonContext | null> {
  if (!profileId) return null;
  const db = admin();
  const { data: salon } = await db
    .from('salons')
    .select('id, name, vertical, phone, email, owner_id')
    .eq('owner_id', profileId)
    .maybeSingle();
  if (!salon) return null;

  const [{ data: manager }, { data: masters }] = await Promise.all([
    db.from('profiles').select('full_name, phone, email').eq('id', profileId).maybeSingle(),
    db.from('masters')
      .select('id, slug, display_name, specialization, avatar_url, profile_id')
      .eq('salon_id', salon.id)
      .eq('is_active', true)
      .neq('profile_id', profileId)
      .limit(20),
  ]);

  return {
    salon: { id: salon.id, name: salon.name, vertical: salon.vertical, phone: salon.phone, email: salon.email },
    manager: { full_name: manager?.full_name ?? null, phone: manager?.phone ?? null, email: manager?.email ?? null },
    members: ((masters ?? []) as Array<{ id: string; slug: string | null; display_name: string | null; specialization: string | null; avatar_url: string | null }>),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const master = await loadMaster(handle);
  if (!master) return { title: 'Master not found · CRES-CA' };
  const lang = await getServerLocale(await isViewerOwner(master.profile_id));
  const tt = STR[lang];
  const name = master.display_name ?? tt.masterFallback;
  const title =
    master.meta_title ??
    (master.specialization
      ? `${name} — ${master.specialization} · CRES-CA`
      : `${name} · CRES-CA`);
  const verb = tt.bookVerb[master.page_type ?? 'master'] ?? tt.bookVerb.master;
  const description =
    master.meta_description ??
    master.headline ??
    (master.bio
      ? master.bio.slice(0, 160)
      : `${verb} ${name}${master.city ? tt.inCity(master.city) : ''} · CRES-CA`);
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

  const lang = await getServerLocale(await isViewerOwner(master.profile_id));
  const tt = STR[lang];

  const [services, portfolio, beforeAfter, reviewsList, partners, salon, ownedSalon] = await Promise.all([
    loadServices(master.id),
    loadPortfolio(master.id),
    loadBeforeAfter(master.id),
    loadReviews(master.id),
    loadPartners(master.id),
    loadSalon(master.salon_id),
    loadOwnedSalonContext(master.profile_id),
  ]);
  const displayName = master.display_name ?? tt.masterFallback;
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

  const normalizedHours = normalizeWorkingHours(master.working_hours);
  const hasWorkingHours = (Object.keys(normalizedHours) as Array<keyof typeof normalizedHours>).some(
    (k) => normalizedHours[k].enabled && normalizedHours[k].intervals.length > 0,
  );
  const hasAddress = !!(master.city || master.address || salon?.address);
  // Online-мастер: если работает онлайн и физический адрес не указан —
  // блок «Адрес и часы работы» сворачивается до одних только часов.
  const worksOnline = master.works_online === true;
  const showAddressBlock = hasAddress || !worksOnline;

  const queryStr = (() => {
    const cleanedStreet = cleanAddress(salon?.address ?? master.address);
    return [cleanedStreet, master.city].filter(Boolean).join(', ') || master.city || '';
  })();
  const fullAddress = composeAddress(null, salon?.address ?? master.address, master.city);

  const minPrice = hasServices
    ? Math.min(...services.filter((s) => s.price != null).map((s) => s.price as number))
    : 0;
  const currency = services[0]?.currency ?? 'UAH';

  const bookHref = `/${lang}/book?master=${master.id}`;

  // Sticky tab nav — show only when there's >1 section to jump to
  const navSections: { id: string; label: string }[] = [];
  if (hasServices) navSections.push({ id: 'services', label: tt.navServices });
  if (hasPortfolio) navSections.push({ id: 'portfolio', label: tt.navPortfolio });
  if (hasReviews) navSections.push({ id: 'reviews', label: tt.navReviews });
  if (hasAddress) navSections.push({ id: 'address', label: tt.navAddress });
  if (hasPartners) navSections.push({ id: 'partners', label: tt.partners });

  // Тема публички следует ТОЛЬКО за системной темой пользователя
  // (prefers-color-scheme). Никаких master-настроек фона/картинки —
  // bg=var(--m-bg) и text=var(--m-text), которые автоматически
  // инвертируются через media-query в globals.css. Фон-картинка и
  // hex-цвет от мастера игнорируются (поля остаются в DB но не рендерятся).
  return (
    <div
      className="public-master-scope min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--m-bg)',
        color: 'var(--m-text)',
        ['--page-accent' as string]: accent,
        // TG WebApp X-Close + Menu сверху накрывают контент — резервируем
        // safe-area-top. На обычном вебе env() = 0, без изменений.
        paddingTop: 'max(var(--tg-safe-top, 0px), env(safe-area-inset-top, 0px))',
      }}
    >
      <MiniAppBackBar />
      <MiniAppBottomPad />
      <PublicBackButton masterProfileId={master.profile_id} />
      <RefCapture />
      <PartnerRefCapture />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Cover banner — inline-editable для owner. Если cover_url пуст и
          текущий пользователь — owner, показывается dashed-CTA «Добавьте обложку».
          Иначе для клиента — image либо ничего. */}
      <div id="inline-cover" className="scroll-mt-24">
        <InlineCoverBanner
          masterId={master.id}
          masterProfileId={master.profile_id}
          initialCoverUrl={master.cover_url}
          initialBannerY={master.banner_position_y}
          initialBannerX={master.banner_position_x}
          initialBannerScale={master.banner_scale}
        />
      </div>

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
          {/* ─── LEFT col — обычный скролл вместе со страницей.
               Раньше был sticky с собственным внутренним скроллом — выглядело
               как два независимых скролл-стека. Теперь всё едет одной
               страницей. ─── */}
          <div className="lg:col-span-4 space-y-4">
            <PublicHeroCard
              masterId={master.id}
              masterProfileId={master.profile_id}
              displayName={ownedSalon ? (ownedSalon.salon.name ?? displayName) : displayName}
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
              salonContext={ownedSalon ? {
                vertical: ownedSalon.salon.vertical,
                membersCount: ownedSalon.members.length,
                manager: ownedSalon.manager,
              } : null}
              worksOnline={worksOnline}
            />
            {/* Bio — поднято над кнопками: клиент сначала читает кто такой
                мастер, потом решает «Записаться / Подписаться». На вебе sticky
                LEFT col, на mobile — обычный блок. */}
            <div id="inline-bio" className="scroll-mt-24">
              <InlineBioBlock
                masterId={master.id}
                masterProfileId={master.profile_id}
                initialBio={master.bio}
              />
            </div>
            {void hasBio /* legacy var */}

            {/* Главные CTA — «Записаться» + «Подписаться» в строку. Скрыты для
                владельца. */}
            <OwnerHiddenCTAs
              masterId={master.id}
              masterProfileId={master.profile_id}
            />

            {/* CRES-CA ID — публичный handle, клик копирует ссылку */}
            {(master.slug || master.invite_code) && (
              <div className="flex justify-center">
                <PublicCresIdBadge
                  handle={master.slug || master.invite_code!}
                  masterProfileId={master.profile_id}
                />
              </div>
            )}

            {/* Способы связи — соцсети / мессенджеры. Размещены здесь,
                сразу под блоком «Записаться», чтобы клиент видел контакты
                не прокручивая всю страницу. */}
            <div id="inline-social" className="scroll-mt-24">
              <InlineSocialBlock
                masterId={master.id}
                masterProfileId={master.profile_id}
                initialSocialLinks={(master.social_links ?? null) as ({ telegram?: string; instagram?: string; whatsapp?: string; viber?: string; tiktok?: string; youtube?: string; facebook?: string; website?: string } | null)}
              />
            </div>

            {/* Inline-панель быстрых настроек — видна только владельцу.
                Полный редактор открывается изнутри через cres:open-full-editor
                window event (этот компонент сам диспатчит). Не передаём
                callback через server boundary. */}
            <OwnerInlineQuickSettings masterProfileId={master.profile_id} />
          </div>

          {/* ─── RIGHT col (scroll content) ─── */}
          <div className="space-y-10 lg:col-span-8">
            {/* Owner-only completeness checklist — показывается только владельцу
                страницы, ведёт в нужные разделы для заполнения. Прячется когда
                всё заполнено. Сразу под навигацией, чтобы было заметно. */}
            <OwnerCompletenessPrompt masterProfileId={master.profile_id} />

            {/* Sticky tab nav — Fresha underline-style. accent=var(--m-text)
                чтобы активный таб и подчёркивающая линия были чёрными в светлой
                теме / белыми в тёмной (как у Fresha). */}
            {navSections.length > 1 && (
              <MasterPageSectionTabs
                sections={navSections}
                accent="var(--m-text)"
                topOffset={64}
              />
            )}

            {/* Bio переехал в LEFT col над кнопками «Записаться/Подписаться». */}

            {/* Интересы и увлечения — показываем сразу под «О мастере»,
                до блока услуг, чтобы клиент узнал мастера как личность. */}
            <div id="inline-interests" className="scroll-mt-24">
              <InlineInterestsBlock
                masterId={master.id}
                masterProfileId={master.profile_id}
                initialInterests={master.interests ?? null}
              />
            </div>

            {/* Services — заголовок «Услуги» + кнопка «Показать все» внутри компонента */}
            {hasServices && (
              <section id="services" className="scroll-mt-24">
                <PublicServicesList services={services} masterId={master.id} locale="ru" />
              </section>
            )}

            {/* Portfolio — единый блок: владелец видит кнопку добавления,
                все видят сетку с лайтбоксом. OwnerPortfolioPanel рендерит null
                если не владелец и нет работ. */}
            <section id="portfolio" className="scroll-mt-24">
              <OwnerPortfolioPanel
                masterProfileId={master.profile_id}
                masterId={master.id}
                initialItems={portfolio.map((p) => ({
                  id: p.id,
                  image_url: p.image_url,
                  caption: p.caption,
                  item_x: p.item_x,
                  item_y: p.item_y,
                  item_scale: p.item_scale,
                }))}
              />
              {beforeAfter.length > 0 && (
                <div className={portfolio.length > 0 ? 'mt-6' : ''}>
                  <p className="mb-3 text-sm text-neutral-500">
                    {tt.beforeAfterHint}
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

            {/* Reviews */}
            {hasReviews && (
              <section id="reviews" className="scroll-mt-24">
                <div className="mb-4 flex items-baseline gap-2">
                  <h2 className="text-[22px] font-bold text-neutral-900">{tt.reviewsHeading}</h2>
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
                <PublicReviewsList
                  reviews={reviewsList}
                  anonymousLabel={tt.anonymousLabel}
                  dateLocale={tt.ratingDateLocale}
                  initialCount={4}
                  showAllLabel={tt.showAllReviews}
                  collapseLabel={tt.collapseReviews}
                />
              </section>
            )}

            {/* Address + Hours — inline-editable. Каждый блок сам решает скрыться
                для клиента когда пусто и показать dashed-CTA для владельца.
                Если мастер online и адрес не указан — адрес блок прячем,
                часы остаются на всю ширину. */}
            <section id="address" className="scroll-mt-24">
              <h2 className="mb-4 text-[22px] font-bold text-neutral-900">
                {showAddressBlock ? tt.addressAndHours : tt.hoursOnly}
              </h2>
              <div className={showAddressBlock ? 'grid gap-5 sm:grid-cols-2' : ''}>
                {showAddressBlock && (
                  <div id="inline-address" className="scroll-mt-24">
                    <InlineAddressBlock
                      masterId={master.id}
                      masterProfileId={master.profile_id}
                      initialCity={master.city}
                      initialAddress={master.address}
                      workplaceName={salon?.name ?? master.workplace_name ?? null}
                    />
                  </div>
                )}
                <div id="inline-hours" className="scroll-mt-24">
                  <InlineHoursBlock
                    masterId={master.id}
                    masterProfileId={master.profile_id}
                    initialHours={master.working_hours}
                  />
                </div>
              </div>
              {master.booking_important_info && master.booking_important_info.trim().length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Phone className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-amber-900">{tt.importantInfo}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-amber-900/80">
                        {master.booking_important_info}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Workplace photos (только если есть отдельные фото — иначе уже в карте) */}
            {hasWorkplace && (salon?.cover_url || master.workplace_photo_url) && (
              <section id="workplace">
                <h2 className="mb-4 text-[22px] font-bold text-neutral-900">{tt.workplace}</h2>
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
              <section id="partners" className="scroll-mt-24">
                <h2 className="mb-2 text-[22px] font-bold text-neutral-900">{tt.partners}</h2>
                <p className="mb-4 text-[14px] text-neutral-500">{tt.partnersDesc}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {partners.map((p) => (
                    <Link
                      key={p.id}
                      // ?from=<master.id> — атрибуция партнёрской рекомендации.
                      // PartnerRefCapture на странице партнёра запишет это в
                      // sessionStorage cres_partner_ref. При следующей записи
                      // у партнёра новый client row получит referrer_master_id.
                      href={p.invite_code ? `/m/${p.invite_code}?from=${master.id}` : '#'}
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
                        {p.display_name || tt.masterFallback}
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

      {/* Mobile sticky bottom CTA — visible while scrolling on phones.
          В Mini App клиента поднимается над floating-pill bottom-nav через
          --mini-app-bottom-pad (см. MiniAppBottomPad). На вебе пад = 0. */}
      <div
        className="fixed inset-x-0 z-30 border-t backdrop-blur p-3 lg:hidden"
        style={{
          bottom: 'calc(var(--mini-app-bottom-pad, 0px) + env(safe-area-inset-bottom, 0px))',
          background: 'color-mix(in oklab, var(--m-bg) 95%, transparent)',
          borderColor: 'var(--m-border)',
        }}
      >
        <BookingCTA variant="sticky">
          {tt.bookCta}{hasServices && ` · ${tt.from} ${formatMoney(minPrice, currency)}`}
        </BookingCTA>
      </div>
      <div
        className="lg:hidden"
        style={{ height: 'calc(80px + var(--mini-app-bottom-pad, 0px))' }}
      />
      </BookingDrawerProvider>
    </div>
  );
}
