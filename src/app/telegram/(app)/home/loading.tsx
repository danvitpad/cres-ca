/** --- YAML
 * name: (app)/home loading skeleton
 * description: Mini App loading placeholder for client home — next appointment
 *              hero + regulars avatar row + recommended cards.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonAvatarRow, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={140} />
      <SkeletonAvatarRow count={5} />
      <SkeletonCardRow count={3} height={120} />
      <SkeletonNavBar />
    </>
  );
}
