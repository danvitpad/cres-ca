/** --- YAML
 * name: SalonBookingCTA
 * description: Client-кнопки «Записаться» для страницы салона. 3 варианта:
 *              hero — большая outlined в hero card,
 *              sticky — solid black для mobile sticky bottom,
 *              master — компактная для карточки мастера в team grid.
 *              Все используют useSalonBookingDrawer().
 * created: 2026-04-27
 * --- */

'use client';

import { Calendar } from 'lucide-react';
import { useSalonBookingDrawer } from './salon-booking-context';

interface Props {
  variant: 'hero' | 'sticky' | 'master';
  /** Pre-select master when clicking from his card. */
  masterId?: string;
  label?: string;
  className?: string;
}

export function SalonBookingCTA({ variant, masterId, label, className }: Props) {
  const { open } = useSalonBookingDrawer();
  const text = label ?? 'Записаться';

  if (variant === 'hero') {
    return (
      <button
        type="button"
        onClick={() => open({ masterId: masterId ?? null })}
        className={
          'inline-flex h-12 w-full items-center justify-center rounded-[var(--brand-radius-lg)] border border-[#2563eb] bg-white text-[15px] font-semibold text-[#2563eb] transition-colors hover:bg-[#2563eb]/5 ' +
          (className ?? '')
        }
      >
        <Calendar className="mr-2 size-4" />
        {text}
      </button>
    );
  }

  if (variant === 'sticky') {
    return (
      <button
        type="button"
        onClick={() => open({ masterId: masterId ?? null })}
        className={
          'flex w-full items-center justify-center gap-2 rounded-[var(--brand-radius-lg)] bg-[#2563eb] px-6 py-3 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#1d4ed8] ' +
          (className ?? '')
        }
      >
        <Calendar className="mr-2 size-4" />
        {text}
      </button>
    );
  }

  // master variant
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open({ masterId: masterId ?? null });
      }}
      className={
        'inline-flex items-center gap-1 rounded-[var(--brand-radius-lg)] border border-[#2563eb] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2563eb] transition-colors hover:bg-[#2563eb]/5 ' +
        (className ?? '')
      }
    >
      {text}
    </button>
  );
}
