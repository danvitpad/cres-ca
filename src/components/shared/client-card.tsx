/** --- YAML
 * name: ClientCard (compact)
 * description: Compact client chip with avatar, name, tier segment badge, and optional meta (last visit / total spent).
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ClientTier = 'new' | 'regular' | 'vip' | 'sleeping';

const TIER_STYLES: Record<ClientTier, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', label: 'Новый' },
  regular: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Постоянный' },
  vip: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', label: 'VIP' },
  sleeping: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Спящий' },
};

export function ClientCard({
  name,
  avatar,
  tier,
  meta,
  onClick,
  className,
}: {
  name: string;
  avatar?: string | null;
  tier?: ClientTier;
  meta?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const tierStyle = tier ? TIER_STYLES[tier] : null;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left',
        onClick && 'hover:bg-muted/40 transition-colors',
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium overflow-hidden">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          {tierStyle && (
            <span
              className={cn(
                'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium',
                tierStyle.bg,
                tierStyle.text,
              )}
            >
              {tierStyle.label}
            </span>
          )}
        </div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
    </Wrapper>
  );
}
