/** --- YAML
 * name: HelpHint
 * description: Маленькая «?» иконка рядом с заголовком, при наведении/клике —
 *              popover с длинным человеческим объяснением (как работает фича,
 *              кому начисляются бонусы, что увидит мастер/команда). Использует
 *              base-ui Popover чтобы текст помещался без обрезки.
 * created: 2026-04-30
 * --- */

'use client';

import { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

interface HelpHintProps {
  title?: string;
  children: ReactNode;
  className?: string;
  size?: number;
}

export function HelpHint({ title, children, className, size = 14 }: HelpHintProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1',
          className,
        )}
        aria-label="Подсказка"
      >
        <HelpCircle size={size} />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50">
          <PopoverPrimitive.Popup
            className={cn(
              'max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-xl',
              'text-[13px] leading-relaxed text-neutral-700',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
              'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            )}
          >
            {title && (
              <p className="mb-2 text-[13px] font-semibold text-neutral-900">{title}</p>
            )}
            <div className="space-y-2 text-[12.5px] text-neutral-600">{children}</div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
