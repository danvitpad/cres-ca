/** --- YAML
 * name: m/profile loading skeleton
 * description: Mini App loading placeholder for master profile — avatar/cover
 *              hero + field rows. No nav-bar (profile uses fullscreen layout).
 * created: 2026-05-09
 * --- */

import { SkeletonStyles, SkeletonHero, SkeletonCardRow } from '@/components/miniapp/skeletons';

export default function Loading() {
  return (
    <>
      <SkeletonStyles />
      <SkeletonHero height={180} />
      <SkeletonCardRow count={6} height={56} />
    </>
  );
}
