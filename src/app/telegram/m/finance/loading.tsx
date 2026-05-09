/** --- YAML
 * name: m/finance loading skeleton
 * description: Mini App loading placeholder for master finance — KPI hero
 *              + history rows.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={120} />
      <SkeletonCardRow count={5} height={64} />
      <SkeletonNavBar />
    </>
  );
}
