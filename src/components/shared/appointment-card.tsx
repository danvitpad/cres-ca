/** --- YAML
 * name: AppointmentCard
 * description: Appointment row with time, client + service, status dot and optional AI hint. Compact for lists.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppointmentStatus = 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  booked: 'bg-blue-500',
  confirmed: 'bg-indigo-500',
  in_progress: 'bg-amber-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-muted-foreground',
  no_show: 'bg-red-500',
};

export function AppointmentCard({
  startsAt,
  endsAt,
  clientName,
  serviceName,
  price,
  currency = '₴',
  status,
  aiHint,
  onClick,
  className,
}: {
  startsAt: string | Date;
  endsAt?: string | Date;
  clientName: string;
  serviceName?: string | null;
  price?: number | null;
  currency?: string;
  status: AppointmentStatus;
  aiHint?: string;
  onClick?: () => void;
  className?: string;
}) {
  const start = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const end = endsAt ? (typeof endsAt === 'string' ? new Date(endsAt) : endsAt) : null;

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 rounded-xl border bg-card p-3 text-left',
        onClick && 'hover:bg-muted/40 transition-colors',
        className,
      )}
    >
      <div className="flex flex-col items-center shrink-0 w-14 pt-0.5">
        <span className="text-sm font-semibold">{fmtTime(start)}</span>
        {end && (
          <span className="text-[10px] text-muted-foreground">{fmtTime(end)}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_COLOR[status])} />
          <span className="font-medium truncate">{clientName}</span>
          {typeof price === 'number' && (
            <span className="ml-auto text-sm text-muted-foreground shrink-0">
              {price} {currency}
            </span>
          )}
        </div>
        {serviceName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="w-3 h-3" />
            {serviceName}
          </div>
        )}
        {aiHint && (
          <div className="flex items-start gap-1 mt-1 text-xs text-[var(--f-accent,hsl(var(--primary)))]">
            <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="truncate">{aiHint}</span>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
