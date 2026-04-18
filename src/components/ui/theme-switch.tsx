/** --- YAML
 * name: ThemeSwitch
 * description: Pill-shaped theme toggle (80×36). Sun left / Moon right, sliding thumb. Uses next-themes.
 * created: 2026-04-18
 * updated: 2026-04-18
 * source: .workspace/components/theme-toggle.txt
 * --- */

'use client';

import * as React from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';

type ThemeSwitchProps = React.HTMLAttributes<HTMLButtonElement> & {
  'aria-label'?: string;
};

export function ThemeSwitch({ className, ...props }: ThemeSwitchProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn('h-9 w-20 shrink-0', className)} />;
  }

  const checked = resolvedTheme === 'dark';
  const toggle = () => setTheme(checked ? 'light' : 'dark');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={props['aria-label'] ?? 'Toggle theme'}
      onClick={toggle}
      className={cn(
        'relative inline-flex h-9 w-20 shrink-0 items-center rounded-full border border-border/60 bg-input/50 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'cursor-pointer',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-10 flex size-7 items-center justify-center rounded-full bg-background shadow-md transition-transform duration-200 ease-out',
          checked ? 'translate-x-[44px]' : 'translate-x-1',
        )}
      />

      <span className="pointer-events-none absolute inset-y-0 left-2 z-0 flex items-center justify-center">
        <SunIcon
          size={16}
          className={cn(
            'transition-all duration-200 ease-out',
            checked ? 'text-muted-foreground/70' : 'scale-110 text-foreground',
          )}
        />
      </span>

      <span className="pointer-events-none absolute inset-y-0 right-2 z-0 flex items-center justify-center">
        <MoonIcon
          size={16}
          className={cn(
            'transition-all duration-200 ease-out',
            checked ? 'scale-110 text-foreground' : 'text-muted-foreground/70',
          )}
        />
      </span>
    </button>
  );
}

export default ThemeSwitch;
