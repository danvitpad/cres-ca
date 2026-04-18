/** --- YAML
 * name: StockLevelIndicator
 * description: Visual stock gauge — bar + quantity/unit. Green when above threshold, yellow near it, red when at or below.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { cn } from '@/lib/utils';

export function StockLevelIndicator({
  current,
  threshold,
  unit = '',
  className,
}: {
  current: number;
  threshold: number;
  unit?: string;
  className?: string;
}) {
  const safeThreshold = threshold > 0 ? threshold : 1;
  const ratio = Math.min(1, Math.max(0, current / (safeThreshold * 2)));

  const level: 'critical' | 'low' | 'ok' =
    current <= safeThreshold * 0.5 ? 'critical' : current <= safeThreshold ? 'low' : 'ok';

  const barColor =
    level === 'critical'
      ? 'bg-red-500'
      : level === 'low'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  const textColor =
    level === 'critical'
      ? 'text-red-500'
      : level === 'low'
        ? 'text-amber-500'
        : 'text-emerald-500';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-medium', textColor)}>
          {current} {unit}
        </span>
        <span className="text-muted-foreground">
          min {threshold} {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
