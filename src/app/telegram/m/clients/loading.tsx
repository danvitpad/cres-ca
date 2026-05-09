/** --- YAML
 * name: m/clients loading skeleton
 * description: Mini App loading placeholder for master clients list — search
 *              bar + 8 client rows.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={48} />
      <SkeletonCardRow count={8} height={72} />
      <SkeletonNavBar />
    </>
  );
}
