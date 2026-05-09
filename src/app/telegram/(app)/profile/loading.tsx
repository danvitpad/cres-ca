/** --- YAML
 * name: (app)/profile loading skeleton
 * description: Mini App loading placeholder for client profile — avatar hero
 *              + field rows.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={160} />
      <SkeletonCardRow count={4} height={56} />
      <SkeletonNavBar />
    </>
  );
}
