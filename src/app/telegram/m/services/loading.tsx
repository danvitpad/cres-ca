/** --- YAML
 * name: m/services loading skeleton
 * description: Mini App loading placeholder for master services list.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonCardRow count={6} height={96} />
      <SkeletonNavBar />
    </>
  );
}
