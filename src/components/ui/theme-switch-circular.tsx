/** --- YAML
 * name: ThemeSwitchCircular
 * description: Circular icon theme toggle with framer-motion rotate/scale. Sizes sm(32)/md(40)/lg(48).
 * created: 2026-04-18
 * updated: 2026-04-18
 * source: .workspace/components/theme-toggle.txt
 * --- */

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const sizeMap: Record<Size, { box: string; icon: string; iconPx: number }> = {
  sm: { box: 'h-8 w-8', icon: 'size-4', iconPx: 16 },
  md: { box: 'h-10 w-10', icon: 'size-[18px]', iconPx: 18 },
  lg: { box: 'h-12 w-12', icon: 'size-6', iconPx: 24 },
};

type ThemeSwitchCircularProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size;
};

export function ThemeSwitchCircular({
  className,
  size = 'lg',
  'aria-label': ariaLabel,
  ...props
}: ThemeSwitchCircularProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const dims = sizeMap[size];

  if (!mounted) {
    return <div className={cn('shrink-0 rounded-full', dims.box, className)} />;
  }

  const checked = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? 'Toggle theme'}
      onClick={() => setTheme(checked ? 'light' : 'dark')}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors',
        'hover:border-primary/40 hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'cursor-pointer',
        dims.box,
        className,
      )}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={checked ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          {checked ? (
            <MoonIcon className={dims.icon} />
          ) : (
            <SunIcon className={dims.icon} />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default ThemeSwitchCircular;
