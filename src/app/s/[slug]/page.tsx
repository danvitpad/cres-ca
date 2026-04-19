/** --- YAML
 * name: Public Salon Showcase
 * description: Публичная страница салона — server-rendered для SEO. Slug = salons.id (UUID).
 *              Показывает название, логотип/обложку, город, телефон, bio, сетку мастеров, follow-кнопку,
 *              Schema.org LocalBusiness JSON-LD, CTA "Записаться" → /book?salon=<id>.
 * created: 2026-04-19
 * --- */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Mail, Calendar, Star } from 'lucide-react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { SalonFollowButton } from '@/components/salon/salon-follow-button';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface SalonRow {
  id: string;
  owner_id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  cover_url: string | null;
  bio: string | null;
  team_mode: 'unified' | 'marketplace';
}

interface MemberRow {
  master_id: string | null;
  role: 'admin' | 'master' | 'receptionist';
  status: string;
  master: { id: string; display_name: string | null; specialization: string | null; avatar_url: string | null; invite_code: string | null; rating: number | null } | null;
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function loadSalon(slug: string): Promise<{ salon: SalonRow; masters: NonNullable<MemberRow['master']>[] } | null> {
  const a = admin();
  const { data: salon } = await a
    .from('salons')
    .select('id, owner_id, name, city, phone, email, logo_url, cover_url, bio, team_mode')
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

  const byId = new Map<string, NonNullable<MemberRow['master']>>();
  (soloMasters ?? []).forEach((m) => {
    if (m.is_active) byId.set(m.id, m);
  });
  ((members as unknown as MemberRow[] | null) ?? []).forEach((mm) => {
    const mArr = (mm.master as unknown) as (NonNullable<MemberRow['master']> | NonNullable<MemberRow['master']>[] | null);
    const mObj = Array.isArray(mArr) ? mArr[0] ?? null : mArr;
    if (mObj && !byId.has(mObj.id)) byId.set(mObj.id, mObj);
  });

  return { salon: salon as SalonRow, masters: Array.from(byId.values()) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSalon(slug);
  if (!data) return { title: 'Салон не найден' };
  const { salon } = data;
  const title = `${salon.name}${salon.city ? ` · ${salon.city}` : ''} — CRES-CA`;
  const description = salon.bio ?? `Салон ${salon.name}${salon.city ? ` в городе ${salon.city}` : ''}. Запишитесь онлайн.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: salon.cover_url ? [salon.cover_url] : salon.logo_url ? [salon.logo_url] : [],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PublicSalonPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadSalon(slug);
  if (!data) notFound();
  const { salon, masters } = data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialFollowing = false;
  if (user) {
    const { data: row } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', salon.owner_id)
      .maybeSingle();
    initialFollowing = !!row;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: salon.name,
    image: salon.cover_url ?? salon.logo_url ?? undefined,
    telephone: salon.phone ?? undefined,
    email: salon.email ?? undefined,
    address: salon.city ? { '@type': 'PostalAddress', addressLocality: salon.city } : undefined,
    description: salon.bio ?? undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background sm:h-72">
        {salon.cover_url && (
          <Image
            src={salon.cover_url}
            alt={salon.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
      </div>

      <div className="mx-auto -mt-16 w-full max-w-4xl px-4 pb-12 sm:-mt-20">
        <div className="relative rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-md sm:size-24">
              {salon.logo_url ? (
                <Image src={salon.logo_url} alt={salon.name} fill className="object-cover" sizes="96px" />
              ) : (
                <div className="flex size-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
                  {salon.name[0]?.toUpperCase() ?? 'S'}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{salon.name}</h1>
              {salon.city && (
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {salon.city}
                </div>
              )}
              {salon.bio && <p className="mt-3 text-sm text-muted-foreground">{salon.bio}</p>}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <SalonFollowButton ownerId={salon.owner_id} initialFollowing={initialFollowing} authed={!!user} />
              <Link
                href={`/book?salon=${salon.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                <Calendar className="size-4" />
                Записаться
              </Link>
            </div>
          </div>

          {(salon.phone || salon.email) && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
              {salon.phone && (
                <a href={`tel:${salon.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="size-4" />
                  {salon.phone}
                </a>
              )}
              {salon.email && (
                <a href={`mailto:${salon.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Mail className="size-4" />
                  {salon.email}
                </a>
              )}
            </div>
          )}
        </div>

        {masters.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">Команда ({masters.length})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {masters.map((m) => (
                <Link
                  key={m.id}
                  href={m.invite_code ? `/m/${m.invite_code}` : '#'}
                  className="group flex flex-col items-center rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <div className="relative size-16 overflow-hidden rounded-full bg-muted">
                    {m.avatar_url ? (
                      <Image src={m.avatar_url} alt={m.display_name ?? ''} fill className="object-cover" sizes="64px" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-primary/10 text-lg font-bold text-primary">
                        {(m.display_name ?? 'M')[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <div className="truncate text-sm font-medium group-hover:text-primary">
                      {m.display_name ?? '—'}
                    </div>
                    {m.specialization && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{m.specialization}</div>
                    )}
                    {m.rating ? (
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600">
                        <Star className="size-3 fill-current" />
                        {m.rating.toFixed(1)}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
