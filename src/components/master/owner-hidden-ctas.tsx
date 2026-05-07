'use client';

import { useIsOwner } from './inline/use-is-owner';
import { BookingCTA } from './booking/booking-cta';
import { FollowMasterButton } from './follow-master-button';

interface Props {
  masterId: string;
  masterProfileId: string | null;
}

/** Две главные CTA публичной страницы — «Записаться» и «Подписаться».
 *  Отображаются в строку (две колонки) — клиент видит обе сразу. Скрыты для
 *  владельца страницы (там вместо них inline-edit панели). */
export function OwnerHiddenCTAs({ masterId, masterProfileId }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  if (isOwner) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <BookingCTA variant="hero">Записаться</BookingCTA>
      <FollowMasterButton masterId={masterId} />
    </div>
  );
}
