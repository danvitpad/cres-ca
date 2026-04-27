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
          'inline-flex h-12 w-full items-center justify-center rounded-full border border-neutral-900 bg-white text-[15px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 ' +
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
          'flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-[15px] font-semibold text-white ' +
          (className ?? '')
        }
      >
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
        'inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 ' +
        (className ?? '')
      }
    >
      {text}
    </button>
  );
}
