/** --- YAML
 * name: SalonBookingProvider
 * description: Wraps /s/[slug] и держит state одного booking-drawer для всех
 *              CTA на странице. Принимает masters + aggregated services.
 * created: 2026-04-27
 * --- */

'use client';

import { useState, type ReactNode } from 'react';
import { SalonBookingDrawer } from './salon-booking-drawer';
import { SalonBookingDrawerCtx, type SalonMasterMini, type SalonServiceItem } from './salon-booking-context';

interface Props {
  salonName: string;
  salonCity: string | null;
  masters: SalonMasterMini[];
  services: SalonServiceItem[];
  children: ReactNode;
}

export function SalonBookingProvider({ salonName, salonCity, masters, services, children }: Props) {
  const [open, setOpen] = useState(false);
  const [defaultMasterId, setDefaultMasterId] = useState<string | null>(null);
  const [defaultGroupKey, setDefaultGroupKey] = useState<string | null>(null);

  return (
    <SalonBookingDrawerCtx.Provider
      value={{
        open: (opts) => {
          setDefaultMasterId(opts?.masterId ?? null);
          setDefaultGroupKey(opts?.groupKey ?? null);
          setOpen(true);
        },
      }}
    >
      {children}
      <SalonBookingDrawer
        salonName={salonName}
        salonCity={salonCity}
        masters={masters}
        services={services}
        open={open}
        onClose={() => setOpen(false)}
        defaultMasterId={defaultMasterId}
        defaultGroupKey={defaultGroupKey}
      />
    </SalonBookingDrawerCtx.Provider>
  );
}
