/** --- YAML
 * name: QueueStatus
 * description: Client view of their position in a master's live queue with progress bar
 * --- */

'use client';

import { useTranslations } from 'next-intl';
import { Clock, Users } from 'lucide-react';

interface QueueStatusProps {
  position: number;
  totalWaiting: number;
  estimatedMinutes: number;
}

export function QueueStatus({ position, totalWaiting, estimatedMinutes }: QueueStatusProps) {
  const t = useTranslations('queue');
  const progress = totalWaiting > 0 ? ((totalWaiting - position + 1) / totalWaiting) * 100 : 0;
  const isNext = position === 1;

  return (
    <div className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] font-bold">
          #{position}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {isNext ? t('youAreNext') : t('position', { position })}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('estimatedWait', { minutes: estimatedMinutes })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totalWaiting}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--ds-accent)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
