/** --- YAML
 * name: (app)/activity loading skeleton
 * description: Mini App loading placeholder for client appointments list.
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonCardRow, SkeletonNavBar } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonCardRow count={6} height={104} />
      <SkeletonNavBar />
    </>
  );
}
