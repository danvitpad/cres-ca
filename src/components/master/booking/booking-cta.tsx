/** --- YAML
 * name: BookingCTA
 * description: Кнопка-триггер «Записаться» для публичной страницы мастера.
 *              Через context открывает BookingDrawer. Если контекста нет
 *              (страница без provider) — fallback на /book route.
 *              3 варианта: hero (большая outline), service (compact pill),
 *              sticky (mobile bottom solid black).
 * created: 2026-04-26
 * --- */

'use client';

import { Calendar } from 'lucide-react';
import { useBookingDrawer } from './booking-context';

interface Props {
  variant?: 'hero' | 'service' | 'sticky';
  serviceId?: string | null;
  children?: React.ReactNode;
  /** Дополнительный класс — например для override стилей */
  className?: string;
}

export function BookingCTA({ variant = 'hero', serviceId, children, className }: Props) {
  const { open } = useBookingDrawer();

  const cls =
    variant === 'hero'
      ? 'inline-flex h-12 w-full items-center justify-center rounded-[var(--brand-radius-lg)] border border-neutral-900 bg-white text-[15px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 active:scale-[0.99]'
      : variant === 'service'
      ? 'shrink-0 rounded-[var(--brand-radius-lg)] border border-neutral-900 px-5 py-2 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white active:scale-[0.98]'
      : 'flex h-12 w-full items-center justify-center gap-2 rounded-[var(--brand-radius-lg)] bg-neutral-900 text-[15px] font-semibold text-white transition-opacity hover:opacity-95 active:scale-[0.99]';

  return (
    <button
      type="button"
      onClick={() => open(serviceId ?? null)}
      className={(className ? className + ' ' : '') + cls}
    >
      {variant === 'hero' && <Calendar className="mr-2 size-4" />}
      {variant === 'sticky' && <Calendar className="size-4" />}
      {children ?? 'Записаться'}
    </button>
  );
}
