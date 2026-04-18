/** --- YAML
 * name: PeriodSelector
 * description: Dropdown for selecting a time period (today/week/month/quarter/year/custom). Emits `{ key, start, end }`.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'year';

export type Period = {
  key: PeriodKey;
  label: string;
  start: Date;
  end: Date;
};

function makePeriod(key: PeriodKey): Period {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (key) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { key, label: 'Сегодня', start, end };
    case 'week': {
      const day = (now.getDay() + 6) % 7; // Monday = 0
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { key, label: 'Неделя', start, end };
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { key, label: 'Месяц', start, end };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      start.setMonth(q * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(q * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      return { key, label: 'Квартал', start, end };
    }
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      return { key, label: 'Год', start, end };
  }
}

const OPTIONS: PeriodKey[] = ['today', 'week', 'month', 'quarter', 'year'];

export function PeriodSelector({
  value,
  onChange,
  className,
}: {
  value: PeriodKey;
  onChange: (p: Period) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = makePeriod(value);

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background text-sm hover:bg-muted/50 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 opacity-60" />
        {current.label}
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-background border rounded-lg shadow-lg py-1">
            {OPTIONS.map((key) => {
              const p = makePeriod(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50',
                    key === value && 'font-medium text-primary',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export { makePeriod };
