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

  // Fresha-style: главная CTA — solid контрастная (text-color → bg-color
  // инверсия). В светлой теме = чёрная кнопка с белым текстом, в тёмной =
  // светлая с тёмным. Через CSS-переменные публичной темы.
  const baseCls = (className ? className + ' ' : '') +
    'inline-flex items-center justify-center font-semibold transition-opacity active:scale-[0.99]';

  if (variant === 'hero') {
    return (
      <button
        type="button"
        onClick={() => open(serviceId ?? null)}
        className={`${baseCls} h-12 w-full rounded-[var(--brand-radius-lg)] text-[15px] hover:opacity-90`}
        style={{
          background: 'var(--m-text)',
          color: 'var(--m-bg)',
          border: 'none',
        }}
      >
        <Calendar className="mr-2 size-4" />
        {children ?? 'Записаться'}
      </button>
    );
  }

  if (variant === 'sticky') {
    return (
      <button
        type="button"
        onClick={() => open(serviceId ?? null)}
        className={`${baseCls} h-12 w-full gap-2 rounded-[var(--brand-radius-lg)] text-[15px] hover:opacity-90`}
        style={{
          background: 'var(--m-text)',
          color: 'var(--m-bg)',
        }}
      >
        <Calendar className="size-4" />
        {children ?? 'Записаться'}
      </button>
    );
  }

  // service-row CTA — компактная outline pill, наводя — заливается
  return (
    <button
      type="button"
      onClick={() => open(serviceId ?? null)}
      className={`${baseCls} shrink-0 rounded-[var(--brand-radius-lg)] px-5 py-2 text-[13px] hover:opacity-90`}
      style={{
        background: 'transparent',
        color: 'var(--m-text)',
        border: '1px solid var(--m-text)',
      }}
    >
      {children ?? 'Записаться'}
    </button>
  );
}
