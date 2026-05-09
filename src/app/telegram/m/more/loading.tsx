/** --- YAML
 * name: m/more loading skeleton
 * description: Mini App loading placeholder for master "More" section list.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonCardRow count={8} height={56} />
      <SkeletonNavBar />
    </>
  );
}
