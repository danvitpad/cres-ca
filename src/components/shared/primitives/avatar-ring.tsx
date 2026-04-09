/** --- YAML
 * name: AvatarRing
 * description: Circular avatar with configurable gradient ring for top masters or status dot
 * --- */

import { cn } from '@/lib/utils';

interface AvatarRingProps {
  src?: string | null;
  name: string;
  size?: number;
  hasNewContent?: boolean;
  status?: 'online' | 'busy' | 'offline';
  className?: string;
}

const statusColors = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  offline: 'bg-zinc-400',
} as const;

export function AvatarRing({
  src,
  name,
  size = 64,
  hasNewContent = false,
  status,
  className,
}: AvatarRingProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const ringPx = hasNewContent ? 3 : 0;
  const gapPx = hasNewContent ? 2 : 0;
  const innerSize = size - (ringPx + gapPx) * 2;

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {hasNewContent && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #ec4899, #f97316, #a855f7, #ec4899)',
          }}
        />
      )}
      <div
        className="relative overflow-hidden rounded-full bg-muted"
        style={{ width: innerSize, height: innerSize }}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] font-semibold text-sm">
            {initials}
          </div>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-card',
            statusColors[status],
          )}
          style={{ width: size * 0.22, height: size * 0.22 }}
        />
      )}
    </div>
  );
}
