/** --- YAML
 * name: TimelineItem
 * description: Generic timeline row — icon + title + optional description/meta + timestamp + optional action slot.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TimelineItem({
  icon,
  title,
  description,
  meta,
  timestamp,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  meta?: ReactNode;
  timestamp?: string | Date;
  action?: ReactNode;
  className?: string;
}) {
  const ts =
    timestamp instanceof Date
      ? timestamp
      : timestamp
        ? new Date(timestamp)
        : null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-4',
        className,
      )}
    >
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{title}</span>
          {meta}
          {ts && (
            <span className="text-xs text-muted-foreground">
              {ts.toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
