/** --- YAML
 * name: BookingDrawerProvider
 * description: Wrap'ит контент публичной страницы мастера. Хранит open/close state
 *              + selectedServiceId для drawer'а. Все «Записаться» CTA на странице
 *              вызывают useBookingDrawer().open(serviceId?).
 * created: 2026-04-26
 * --- */

'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { BookingDrawerCtx, type BookingMaster, type BookingService } from './booking-context';
import { BookingDrawer } from './booking-drawer';

interface Props {
  master: BookingMaster;
  services: BookingService[];
  children: ReactNode;
}

export function BookingDrawerProvider({ master, services, children }: Props) {
  const [open, setOpen] = useState(false);
  const [defaultServiceId, setDefaultServiceId] = useState<string | null>(null);

  const openDrawer = useCallback((serviceId?: string | null) => {
    setDefaultServiceId(serviceId ?? null);
    setOpen(true);
  }, []);

  return (
    <BookingDrawerCtx.Provider value={{ open: openDrawer }}>
      {children}
      <BookingDrawer
        master={master}
        services={services}
        open={open}
        onClose={() => setOpen(false)}
        defaultServiceId={defaultServiceId}
      />
    </BookingDrawerCtx.Provider>
  );
}
