/** --- YAML
 * name: WithFeature
 * description: Обёртка для гейтинга фичи по подписке. Если `canUse(feature)` — рендерит children, иначе показывает `<PaywallCard>`. Используется вокруг страниц/секций.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import type { ReactNode } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import type { SubscriptionFeature, SubscriptionTier } from '@/types';
import { PaywallCard } from './paywall-card';

interface Props {
  feature: SubscriptionFeature;
  requiredTier: SubscriptionTier;
  featureLabel?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function WithFeature({
  feature,
  requiredTier,
  featureLabel,
  title,
  description,
  children,
  fallback,
}: Props) {
  const { canUse } = useSubscription();

  if (canUse(feature)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <PaywallCard
      feature={featureLabel ?? feature}
      requiredTier={requiredTier}
      title={title}
      description={description}
    />
  );
}
