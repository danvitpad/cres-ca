/** --- YAML
 * name: useFeatures
 * description: Hook that resolves final feature flags for the current master — merges vertical defaults with per-master overrides from profile.feature_overrides.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useMemo } from 'react';
import { useMaster } from '@/hooks/use-master';
import { resolveFeatures, type VerticalFeatures } from '@/lib/verticals/feature-flags';
import type { VerticalKey } from '@/lib/verticals/default-services';

/**
 * Returns the active feature flags for the current master.
 * @example
 *   const features = useFeatures();
 *   {features.gallery && <BeforeAfterSection />}
 *   {features.healthProfile && <HealthTab />}
 */
export function useFeatures(): VerticalFeatures {
  const { master } = useMaster();
  return useMemo(() => {
    const vertical = (master?.vertical as VerticalKey | undefined) || null;
    const overrides = (master?.feature_overrides as Partial<VerticalFeatures> | null | undefined) || null;
    return resolveFeatures(vertical, overrides);
  }, [master?.vertical, master?.feature_overrides]);
}
