/** --- YAML
 * name: SalonBookingContext
 * description: Контекст для глобального single-instance salon booking drawer
 *              на /s/[slug]. Любая «Записаться» кнопка на странице вызывает
 *              open() — drawer открывается с пред-фильтром (мастер или услуга).
 * created: 2026-04-27
 * --- */

'use client';

import { createContext, useContext } from 'react';

export interface SalonMasterMini {
  id: string;
  display_name: string | null;
  specialization: string | null;
  avatar_url: string | null;
  invite_code: string | null;
  rating: number | null;
  city: string | null;
  address: string | null;
  workplace_name: string | null;
}

export interface SalonServiceItem {
  id: string;
  master_id: string;
  name: string;
  duration_minutes: number | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  category_name: string | null;
}

interface Ctx {
  /** Open the drawer. Pre-select master and/or service-group key. */
  open: (opts?: { masterId?: string | null; groupKey?: string | null }) => void;
}

export const SalonBookingDrawerCtx = createContext<Ctx | null>(null);

export function useSalonBookingDrawer(): Ctx {
  const v = useContext(SalonBookingDrawerCtx);
  if (!v) {
    return { open: () => { /* no-op outside provider */ } };
  }
  return v;
}

/** Group key — lowercased trimmed service name. Используется чтобы
 *  собрать услуги «Маникюр» от разных мастеров в одну карточку. */
export function groupKeyOf(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}
