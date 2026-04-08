/** --- YAML
 * name: useSubscription Hook
 * description: Hook to check if current user has access to a specific subscription feature
 * --- */

import { useAuthStore } from '@/stores/auth-store';
import { hasFeature, isWithinClientLimit, isWithinMasterLimit } from '@/types';
import type { SubscriptionFeature } from '@/types';

export function useSubscription() {
  const tier = useAuthStore((s) => s.tier);

  return {
    tier,
    canUse: (feature: SubscriptionFeature) => tier ? hasFeature(tier, feature) : false,
    canAddClient: (currentCount: number) => tier ? isWithinClientLimit(tier, currentCount) : false,
    canAddMaster: (currentCount: number) => tier ? isWithinMasterLimit(tier, currentCount) : false,
  };
}
