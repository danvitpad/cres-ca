/** --- YAML
 * name: ShimmerSkeleton
 * description: Skeleton loader with animated gradient shimmer effect
 * --- */

import { cn } from '@/lib/utils';

interface ShimmerSkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-[var(--radius-card)]',
  full: 'rounded-full',
} as const;

export function ShimmerSkeleton({ className, rounded = 'md' }: ShimmerSkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        roundedMap[rounded],
        className,
      )}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-[var(--radius-card)] bg-card p-[var(--space-card)] shadow-[var(--shadow-card)]', className)}>
      <ShimmerSkeleton className="h-4 w-1/3" />
      <ShimmerSkeleton className="h-8 w-1/2" />
      <ShimmerSkeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <ShimmerSkeleton className="h-10 w-10" rounded="full" />
          <div className="flex-1 space-y-2">
            <ShimmerSkeleton className="h-4 w-2/5" />
            <ShimmerSkeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
