/** --- YAML
 * name: SalonTeamGrid
 * description: Grid мастеров команды салона — Fresha-style карточки. Avatar 80px,
 *              имя жирным, специализация серым, рейтинг chip. Click → /m/{invite_code}.
 *              Кнопка «Записаться» открывает SalonBookingDrawer с pre-выбранным мастером.
 *              Карточка outlined без shadow, hover — neutral border + small lift.
 * created: 2026-04-26
 * updated: 2026-04-27
 * --- */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { SalonBookingCTA } from './booking/salon-booking-cta';

interface TeamMember {
  id: string;
  display_name: string | null;
  specialization: string | null;
  avatar_url: string | null;
  invite_code: string | null;
  rating: number | null;
}

export function SalonTeamGrid({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {members.map((m) => {
        const name = (m.display_name ?? 'Мастер').trim();
        const initial = name[0]?.toUpperCase() ?? 'M';
        const href = m.invite_code ? `/m/${m.invite_code}` : '#';

        return (
          <div
            key={m.id}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-center transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm"
          >
            <Link
              href={href}
              className="flex w-full flex-col items-center gap-3"
            >
              <div className="relative size-20 overflow-hidden rounded-full bg-neutral-100">
                {m.avatar_url ? (
                  <Image src={m.avatar_url} alt={name} fill className="object-cover" sizes="80px" />
                ) : (
                  <div className="flex size-full items-center justify-center text-2xl font-bold text-neutral-400">
                    {initial}
                  </div>
                )}
              </div>
              <div className="min-w-0 max-w-full">
                <p className="truncate text-[14px] font-semibold text-neutral-900 group-hover:text-black">{name}</p>
                {m.specialization && (
                  <p className="mt-0.5 line-clamp-1 text-[12px] text-neutral-500">{m.specialization}</p>
                )}
                {(m.rating ?? 0) > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-neutral-900">
                    <Star className="size-3 fill-amber-400 text-amber-400" strokeWidth={0} />
                    {(m.rating ?? 0).toFixed(1)}
                  </p>
                )}
              </div>
            </Link>
            <SalonBookingCTA variant="master" masterId={m.id} />
          </div>
        );
      })}
    </div>
  );
}
