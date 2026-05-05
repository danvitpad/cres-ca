'use client';

import { useIsOwner } from './inline/use-is-owner';
import { BookingCTA } from './booking/booking-cta';
import { FollowMasterButton } from './follow-master-button';

interface Props {
  masterId: string;
  masterProfileId: string | null;
}

export function OwnerHiddenCTAs({ masterId, masterProfileId }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  if (isOwner) return null;
  return (
    <>
      <BookingCTA variant="hero">Записаться</BookingCTA>
      <FollowMasterButton masterId={masterId} />
    </>
  );
}
