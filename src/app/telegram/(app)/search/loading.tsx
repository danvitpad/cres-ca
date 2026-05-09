/** --- YAML
 * name: (app)/search loading skeleton
 * description: Mini App loading placeholder for client search — search field
 *              hero + master result cards.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={64} />
      <SkeletonCardRow count={6} height={88} />
      <SkeletonNavBar />
    </>
  );
}
