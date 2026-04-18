/** --- YAML
 * name: PillTabs
 * description: Generic segmented tabs with pill look. Controlled by `value` + `onChange`. Works in light/dark.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { cn } from '@/lib/utils';

export type PillTabItem = {
  value: string;
  label: string;
  count?: number;
};

export function PillTabs({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly PillTabItem[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-full',
        'bg-muted/60 dark:bg-white/5',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              active
                ? 'bg-background shadow-sm text-foreground dark:bg-white/10'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'ml-1.5 text-xs',
                  active ? 'opacity-80' : 'opacity-60',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
