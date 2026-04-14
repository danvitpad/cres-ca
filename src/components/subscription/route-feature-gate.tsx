/** --- YAML
 * name: RouteFeatureGate
 * description: Клиентский гард для dashboard-роутов. По текущему pathname ищет правило в ROUTE_FEATURES и при отсутствии фичи в текущем тарифе показывает `<PaywallCard>` вместо children.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSubscription } from '@/hooks/use-subscription';
import { getRouteFeatureRule } from '@/lib/subscription/route-features';
import { PaywallCard } from './paywall-card';

export function RouteFeatureGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { canUse, tier } = useSubscription();
  const rule = getRouteFeatureRule(pathname);

  if (!rule || !tier) return <>{children}</>;
  if (canUse(rule.feature)) return <>{children}</>;

  return (
    <div className="p-6">
      <PaywallCard feature={rule.label} requiredTier={rule.requiredTier} />
    </div>
  );
}
