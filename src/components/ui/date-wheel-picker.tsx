/** --- YAML
 * name: DateWheelPicker
 * description: Simple DD.MM.YYYY text input for date-of-birth. Kept original export name + value/onChange API so 7 call sites don't change. The wheel UX was replaced per user request — text entry is faster and works better on desktop.
 * created: 2026-04-18
 * updated: 2026-04-20
 * --- */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DateWheelPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  locale?: string;
}

const sizeConfig = {
  sm: 'h-10 text-sm',
  md: 'h-12 text-base',
  lg: 'h-14 text-lg',
};

function formatDate(d?: Date): string {
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function parseDate(s: string, minYear = 1900, maxYear = new Date().getFullYear()): Date | null {
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < minYear || year > maxYear) return null;
  const d = new Date(year, month - 1, day);
  if (d.getMonth() + 1 !== month || d.getDate() !== day) return null;
  return d;
}

const DateWheelPicker = React.forwardRef<HTMLDivElement, DateWheelPickerProps>(
  (
    {
      value,
      onChange,
      minYear = 1900,
      maxYear = new Date().getFullYear(),
      size = 'md',
      disabled,
      className,
      ...rest
    },
    ref,
  ) => {
    const [text, setText] = React.useState(formatDate(value));
    const [error, setError] = React.useState(false);

    React.useEffect(() => {
      setText(formatDate(value));
    }, [value]);

    function handleBlur() {
      if (!text.trim()) {
        setError(false);
        return;
      }
      const d = parseDate(text, minYear, maxYear);
      if (d) {
        setError(false);
        onChange(d);
        setText(formatDate(d));
      } else {
        setError(true);
      }
    }

    return (
      <div ref={ref} className={cn('w-full', className)} {...rest}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="ДД.ММ.ГГГГ"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(false);
          }}
          onBlur={handleBlur}
          className={cn(
            'w-full rounded-xl border bg-white/[0.03] px-4 text-center tracking-wider tabular-nums outline-none transition-colors placeholder:text-white/30 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50',
            sizeConfig[size],
            error
              ? 'border-rose-500/60 text-rose-300 focus:border-rose-500'
              : 'border-white/10 text-white focus:border-violet-500/60',
          )}
        />
        {error && (
          <p className="mt-1 text-center text-xs text-rose-400">
            Введите в формате ДД.ММ.ГГГГ
          </p>
        )}
      </div>
    );
  },
);

DateWheelPicker.displayName = 'DateWheelPicker';

/** Local-time ISO day (YYYY-MM-DD). Avoids UTC shift that `d.toISOString().slice(0,10)` causes for birthdays. */
export function toISODay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local-time Date from YYYY-MM-DD. Avoids UTC parsing of `new Date('YYYY-MM-DD')`. */
export function fromISODay(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export { DateWheelPicker };
