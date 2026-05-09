/** --- YAML
 * name: m/calendar loading skeleton
 * description: Mini App loading placeholder for master calendar — header bar
 *              + 6 slot rows. Shown by Next.js streaming during navigation.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={56} />
      <SkeletonCardRow count={6} height={64} />
      <SkeletonNavBar />
    </>
  );
}
