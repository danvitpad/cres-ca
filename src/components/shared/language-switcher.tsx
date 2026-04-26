/** --- YAML
 * name: LanguageSwitcher
 * description: Locale dropdown switcher — changes URL prefix to switch language
 * --- */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';

const LOCALES = [
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const segments = pathname.split('/');
  const currentLocale = LOCALES.find((l) => l.code === segments[1])?.code || 'uk';
  const current = LOCALES.find((l) => l.code === currentLocale)!;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEscapeKey(open, () => setOpen(false));

  function switchLocale(newLocale: string) {
    const newSegments = [...segments];
    newSegments[1] = newLocale;
    router.replace(newSegments.join('/'), { scroll: false });
    setOpen(false);
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Globe className="size-4" />
        <span className="text-xs font-medium">{current.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded-lg border border-border/50 bg-popover/95 backdrop-blur-xl shadow-lg py-1 z-50">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => switchLocale(l.code)}
              className={`flex w-full items-center px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 ${
                l.code === currentLocale ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
