/** --- YAML
 * name: Public Salon Showcase
 * description: Публичная страница салона — Fresha 2-col layout (зеркало /m/[handle]).
 *              LEFT: SalonHeroCard (logo + name + city + rating + «Записаться» CTA +
 *              stats + контакты). RIGHT: команда мастеров, опц. cover-баннер сверху,
 *              JSON-LD LocalBusiness. Slug = salons.id (UUID).
 * created: 2026-04-19
 * updated: 2026-04-26
 * --- */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { SalonHeroCard } from '@/components/salon/salon-hero-card';
import { SalonTeamGrid } from '@/components/salon/salon-team-grid';
import { SalonJoinRequestCard } from '@/components/salon/salon-join-request-card';
import { SalonInlineCoverBanner } from '@/components/salon/inline/salon-cover-banner';
import { SalonInlineBioBlock } from '@/components/salon/inline/salon-bio-block';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface SalonRow {
  id: string;
  owner_id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  cover_url: string | null;
  bio: string | null;
  team_mode: 'unified' | 'marketplace';
  recruitment_open: boolean;
  recruitment_message: string | null;
}

interface MemberRow {
  master_id: string | null;
  role: 'admin' | 'master' | 'receptionist';
  status: string;
  master: {
    id: string;
    display_name: string | null;
    specialization: string | null;
    avatar_url: string | null;
    invite_code: string | null;
    rating: number | null;
    is_active?: boolean;
  } | null;
}

type Master = NonNullable<MemberRow['master']>;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function loadSalon(slug: string): Promise<{
  salon: SalonRow;
  masters: Master[];
  servicesCount: number;
  rating: number;
  reviewsCount: number;
} | null> {
  const a = admin();
  const { data: salon } = await a
    .from('salons')
    .select('id, owner_id, name, city, address, phone, email, logo_url, cover_url, bio, team_mode, recruitment_open, recruitment_message')
    .eq('id', slug)
    .maybeSingle();

  if (!salon) return null;

  const { data: soloMasters } = await a
    .from('masters')
    .select('id, display_name, specialization, avatar_url, invite_code, rating, is_active')
    .eq('salon_id', salon.id)
    .eq('is_active', true)
    .limit(50);

  const { data: members } = await a
    .from('salon_members')
    .select('master_id, role, status, master:masters!salon_members_master_id_fkey(id, display_name, specialization, avatar_url, invite_code, rating, is_active)')
    .eq('salon_id', salon.id)
    .eq('status', 'active');

  const byId = new Map<string, Master>();
  (soloMasters ?? []).forEach((m) => {
    if (m.is_active) byId.set(m.id, m);
  });
  ((members as unknown as MemberRow[] | null) ?? []).forEach((mm) => {
    const mArr = mm.master as Master | Master[] | null;
    const mObj = Array.isArray(mArr) ? mArr[0] ?? null : mArr;
    if (mObj && !byId.has(mObj.id)) byId.set(mObj.id, mObj);
  });

  const masters = Array.from(byId.values());
  const masterIds = masters.map((m) => m.id);

  // Aggregate rating from team members + count services across team
  let rating = 0;
  let reviewsCount = 0;
  if (masterIds.length > 0) {
    const ratings = masters.map((m) => m.rating ?? 0).filter((r) => r > 0);
    if (ratings.length > 0) {
      rating = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    }
    const { count: rc } = await a
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .in('target_id', masterIds)
      .eq('target_type', 'master')
      .eq('is_published', true);
    reviewsCount = rc ?? 0;
  }

  let servicesCount = 0;
  if (masterIds.length > 0) {
    const { count: sc } = await a
      .from('services')
      .select('id', { count: 'exact', head: true })
      .in('master_id', masterIds)
      .eq('is_active', true);
    servicesCount = sc ?? 0;
  }

  return {
    salon: salon as SalonRow,
    masters,
    servicesCount,
    rating,
    reviewsCount,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSalon(slug);
  if (!data) return { title: 'Салон не найден · CRES-CA' };
  const { salon } = data;
  const title = `${salon.name}${salon.city ? ` · ${salon.city}` : ''} — CRES-CA`;
  const description = salon.bio ?? `Салон ${salon.name}${salon.city ? ` в городе ${salon.city}` : ''}. Запишитесь онлайн.`;
  const ogImage = salon.cover_url ?? salon.logo_url ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: ogImage ? [ogImage] : undefined },
  };
}

export default async function PublicSalonPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadSalon(slug);
  if (!data) notFound();
  const { salon, masters, servicesCount, rating, reviewsCount } = data;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: salon.name,
    image: salon.cover_url ?? salon.logo_url ?? undefined,
    telephone: salon.phone ?? undefined,
    email: salon.email ?? undefined,
    address: salon.city
      ? { '@type': 'PostalAddress', addressLocality: salon.city, streetAddress: salon.address ?? undefined }
      : undefined,
    description: salon.bio ?? undefined,
    aggregateRating: reviewsCount > 0
      ? { '@type': 'AggregateRating', ratingValue: rating, reviewCount: reviewsCount }
      : undefined,
  };

  const bookHref = `/ru/book?salon=${salon.id}`;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Cover banner — owner sees dashed CTA when empty. */}
      <SalonInlineCoverBanner
        salonId={salon.id}
        salonOwnerId={salon.owner_id}
        initialCoverUrl={salon.cover_url}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          {/* LEFT: hero card */}
          <div className="lg:col-span-4">
            <SalonHeroCard
              salonId={salon.id}
              salonOwnerId={salon.owner_id}
              name={salon.name}
              logoUrl={salon.logo_url}
              city={salon.city}
              bio={salon.bio}
              phone={salon.phone}
              email={salon.email}
              rating={rating}
              reviewsCount={reviewsCount}
              teamSize={masters.length}
              servicesCount={servicesCount}
              bookHref={bookHref}
            />
          </div>

          {/* RIGHT: team + content */}
          <div className="space-y-10 lg:col-span-8">
            {/* О салоне (для владельца — inline edit, для клиента — read-only / hidden если пусто) */}
            <SalonInlineBioBlock
              salonId={salon.id}
              salonOwnerId={salon.owner_id}
              initialBio={salon.bio}
            />

            {/* Master-only: запрос на вступление в команду */}
            <SalonJoinRequestCard
              salonId={salon.id}
              salonOwnerId={salon.owner_id}
              recruitmentOpen={salon.recruitment_open}
              recruitmentMessage={salon.recruitment_message}
            />

            {masters.length > 0 ? (
              <section>
                <div className="mb-4 flex items-baseline gap-2">
                  <h2 className="text-[22px] font-bold text-neutral-900">Команда</h2>
                  <span className="text-[14px] text-neutral-500">{masters.length}</span>
                </div>
                <SalonTeamGrid members={masters} />
              </section>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
                <p className="text-[15px] font-semibold text-neutral-900">Команда не сформирована</p>
                <p className="mt-1 text-[13px] text-neutral-500">
                  Мастера ещё не присоединились к этому салону.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <a
          href={bookHref}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-[15px] font-semibold text-white"
        >
          Записаться
        </a>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  );
}
