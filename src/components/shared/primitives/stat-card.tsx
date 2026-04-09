/** --- YAML
 * name: StatCard
 * description: Large metric card with label, trend arrow, and optional sparkline for dashboards
 * --- */

'use client';

import { cn } from '@/lib/utils';
import { TrendBadge } from './trend-badge';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
  sparkline?: number[];
  className?: string;
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h} className="text-[var(--ds-accent)]">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function StatCard({ label, value, trend, icon, sparkline, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-card)] bg-card p-[var(--space-card)]',
        'shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-elevated)]',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend !== undefined && <TrendBadge value={trend} />}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
              {icon}
            </div>
          )}
          {sparkline && <MiniSparkline data={sparkline} />}
        </div>
      </div>
    </div>
  );
}
