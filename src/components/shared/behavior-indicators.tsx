/** --- YAML
 * name: BehaviorIndicators
 * description: Shows small colored icons next to client name for behavior indicators (Business tier only)
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { useSubscription } from '@/hooks/use-subscription';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { XCircle, Clock, AlertTriangle, Star } from 'lucide-react';
import type { BehaviorIndicator } from '@/types';

const indicatorConfig: Record<BehaviorIndicator, { icon: typeof XCircle; color: string; labelKey: string }> = {
  frequent_canceller: { icon: XCircle, color: 'text-red-500', labelKey: 'frequentCanceller' },
  often_late: { icon: Clock, color: 'text-orange-500', labelKey: 'oftenLate' },
  rude: { icon: AlertTriangle, color: 'text-red-500', labelKey: 'rude' },
  excellent: { icon: Star, color: 'text-green-500', labelKey: 'excellent' },
};

export function BehaviorIndicators({ indicators }: { indicators: BehaviorIndicator[] }) {
  const { canUse } = useSubscription();
  const t = useTranslations('clients');

  if (!canUse('behavior_indicators') || indicators.length === 0) return null;

  return (
    <span className="inline-flex gap-0.5">
      {indicators.map((ind) => {
        const config = indicatorConfig[ind];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <Tooltip key={ind}>
            <TooltipTrigger>
              <Icon className={`h-4 w-4 ${config.color}`} />
            </TooltipTrigger>
            <TooltipContent>{t(config.labelKey)}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
