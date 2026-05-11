/** --- YAML
 * name: LanguageSwitcher
 * description: Locale dropdown switcher — меняет URL-префикс и сохраняет выбор в
 *              profiles.ui_language через useUiPrefs. Это делает выбор постоянным —
 *              на следующих сессиях/устройствах язык остаётся как выбрал юзер.
 *              Также используется для отправки персональных писем/TG этому юзеру.
 * --- */

'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';
import { useUiPrefs, type UiLanguage } from '@/hooks/use-ui-prefs';
import { defaultLocale } from '@/lib/i18n/config';

const LOCALES = [
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const { updateLanguage } = useUiPrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const segments = pathname.split('/');
  // Если префикса нет — это defaultLocale (UK, см. proxy.ts `localePrefix: 'as-needed'`).
  // Раньше падали на 'uk' при отсутствии префикса — было корректно по совпадению,
  // но если defaultLocale поменяется, всё развалится. Берём из конфига.
  const currentLocale = LOCALES.find((l) => l.code === segments[1])?.code || defaultLocale;
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
    setOpen(false);
    // updateLanguage сам:
    //  1) PATCH /api/me/ui-prefs (сохранит в profiles.ui_language)
    //  2) router.push на новую локаль
    void updateLanguage(newLocale as UiLanguage);
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
