/** --- YAML
 * name: SalonHeroCard
 * description: Sticky левая колонка публичной страницы салона (зеркало
 *              PublicHeroCard для мастера). Logo (квадратный с рамкой) + Name
 *              крупно + Город + рейтинг команды + большая «Записаться» CTA.
 *              Stats — членов команды и кол-во услуг. Phone/email клик-актив.
 * created: 2026-04-26
 * --- */

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Star, Calendar, Phone, Mail } from 'lucide-react';

interface Props {
  salonId: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  reviewsCount: number;
  teamSize: number;
  servicesCount: number;
  bookHref: string;
}

export function SalonHeroCard({
  salonId,
  name,
  logoUrl,
  city,
  bio,
  phone,
  email,
  rating,
  reviewsCount,
  teamSize,
  servicesCount,
  bookHref,
}: Props) {
  void salonId;
  const initial = name.trim()[0]?.toUpperCase() ?? 'S';

  return (
    <aside className="relative flex flex-col gap-5 rounded-[20px] border border-neutral-200 bg-[#f7f7f7] p-6 lg:sticky lg:top-6">
      {/* Logo (square with border) */}
      <div className="mx-auto mt-2 size-32 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={name}
            width={128}
            height={128}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-4xl font-bold text-neutral-400">
            {initial}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="text-center">
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-neutral-900">
          {name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[14px] text-neutral-700">
          {(rating ?? 0) > 0 && reviewsCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold tabular-nums text-neutral-900">{(rating ?? 0).toFixed(1)}</span>
              <Star className="size-4 fill-amber-400 text-amber-400" strokeWidth={0} />
              <span className="text-neutral-500">({reviewsCount})</span>
            </span>
          )}
          {city && (
            <span className="inline-flex items-center gap-1 text-neutral-700">
              <MapPin className="size-3.5 text-neutral-500" /> {city}
            </span>
          )}
        </div>
      </div>

      {bio && (
        <p className="text-center text-[14px] leading-relaxed text-neutral-700">{bio}</p>
      )}

      {/* Main CTA */}
      <Link
        href={bookHref}
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-neutral-900 bg-white text-[15px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
      >
        <Calendar className="mr-2 size-4" />
        Записаться
      </Link>

      <div className="border-t border-neutral-200" />

      {/* Stats */}
      <dl className="space-y-2 text-[14px]">
        {teamSize > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-neutral-700">В команде</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{teamSize}</dd>
          </div>
        )}
        {servicesCount > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-neutral-700">Услуг</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{servicesCount}</dd>
          </div>
        )}
      </dl>

      {/* Contacts */}
      {(phone || email) && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            Связаться
          </p>
          <div className="mt-2 space-y-1.5">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-2 text-[14px] text-neutral-900 hover:underline"
              >
                <Phone className="size-3.5 text-neutral-500" />
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="block truncate text-[14px] text-neutral-900 hover:underline"
              >
                <Mail className="mr-2 inline size-3.5 text-neutral-500" />
                {email}
              </a>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
