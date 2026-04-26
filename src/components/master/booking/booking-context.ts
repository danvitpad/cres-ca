/** --- YAML
 * name: BookingDrawerContext
 * description: React context для глобального single-instance booking drawer
 *              на публичной странице мастера. Любая «Записаться» кнопка
 *              вызывает open(serviceId?) — drawer открывается с предзаполнением.
 * created: 2026-04-26
 * --- */

'use client';

import { createContext, useContext } from 'react';

export interface BookingMaster {
  id: string;
  displayName: string;
  specialization: string | null;
  avatarUrl: string | null;
  city: string | null;
  address: string | null;
  workplaceName: string | null;
}

export interface BookingService {
  id: string;
  name: string;
  duration_minutes: number | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  category: { name: string } | null;
}

interface Ctx {
  /** Open the drawer. Pass serviceId to preselect a service. */
  open: (serviceId?: string | null) => void;
}

export const BookingDrawerCtx = createContext<Ctx | null>(null);

export function useBookingDrawer(): Ctx {
  const v = useContext(BookingDrawerCtx);
  if (!v) {
    return {
      open: () => {
        // Если кнопка вне provider — fallback на /book route
        if (typeof window !== 'undefined') {
          window.location.href = '/ru/book';
        }
      },
    };
  }
  return v;
}
