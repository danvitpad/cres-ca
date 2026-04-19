/** --- YAML
 * name: MasterSalonCard
 * description: Унифицированная карточка master/salon для клиентских экранов.
 *              Использует getDisplayMode() → solo / salon_with_master / salon_only.
 *              Salon name primary, имя мастера secondary — когда мастер в салоне.
 * created: 2026-04-19
 * --- */

'use client';

import Link from 'next/link';
import { Star, Building2, User } from 'lucide-react';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import {
  resolveCardDisplay,
  type MasterRef,
  type SalonRef,
} from '@/lib/client/display-mode';
import { cn } from '@/lib/utils';

export interface MasterSalonCardProps {
  master: MasterRef | null | undefined;
  salon: SalonRef | null | undefined;
  /** Лейблы i18n для placeholder'ов */
  labels: {
    masterPlaceholder: string;
    salonPlaceholder: string;
    managerAssigned: string;
  };
  /** Опциональная ссылка (обычно `/m/<handle>` или `/s/<slug>` или `/s/<slug>/m/<handle>`) */
  href?: string;
  /** Дополнительная подпись снизу (например, "⭐ 4.8 · 12 отзывов" или ближайший слот) */
  meta?: React.ReactNode;
  /** Компактный вид (для списков) */
  compact?: boolean;
  /** Размер аватара (px) */
  avatarSize?: number;
  /** CTA-кнопка справа */
  cta?: React.ReactNode;
  className?: string;
}

export function MasterSalonCard({
  master,
  salon,
  labels,
  href,
  meta,
  compact = false,
  avatarSize = compact ? 48 : 56,
  cta,
  className,
}: MasterSalonCardProps) {
  const display = resolveCardDisplay(master, salon, labels);
  const Icon = display.mode === 'solo' ? User : Building2;

  const body = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/40',
        compact && 'p-2',
        className,
      )}
    >
      <AvatarRing src={display.avatarSrc} name={display.avatarName} size={avatarSize} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <p
            className={cn(
              'min-w-0 truncate font-semibold text-foreground',
              compact ? 'text-sm' : 'text-[15px]',
            )}
            title={display.primary}
          >
            {display.primary}
          </p>
        </div>
        {display.secondary && (
          <p
            className={cn(
              'truncate text-muted-foreground',
              compact ? 'text-[11px]' : 'text-xs',
            )}
            title={display.secondary}
          >
            {display.secondary}
          </p>
        )}
        {(display.rating != null || meta) && (
          <div className={cn('mt-1 flex items-center gap-2 text-[11px] text-muted-foreground', compact && 'mt-0.5')}>
            {display.rating != null && (
              <span className="inline-flex items-center gap-0.5">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="tabular-nums">{display.rating.toFixed(1)}</span>
              </span>
            )}
            {meta}
          </div>
        )}
      </div>

      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
