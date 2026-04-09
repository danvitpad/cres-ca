/** --- YAML
 * name: TrendBadge
 * description: Small pill showing percentage change with up/down arrow in green or red
 * --- */

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendBadgeProps {
  value: number;
  className?: string;
}

export function TrendBadge({ value, className }: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isNeutral && 'bg-muted text-muted-foreground',
        isPositive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        !isPositive && !isNeutral && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
        className,
      )}
    >
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? '+' : ''}{value}%
    </span>
  );
}
