/** --- YAML
 * name: LanguageSwitcher
 * description: Locale dropdown switcher — changes URL prefix to switch language
 * --- */

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LOCALES = [
  { code: 'uk', label: 'UA', flag: '🇺🇦' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const segments = pathname.split('/');
  const currentLocale = LOCALES.find((l) => l.code === segments[1])?.code || 'uk';

  function switchLocale(newLocale: string | null) {
    if (!newLocale) return;
    const newSegments = [...segments];
    newSegments[1] = newLocale;
    router.push(newSegments.join('/'));
  }

  return (
    <Select value={currentLocale} onValueChange={switchLocale}>
      <SelectTrigger className="w-[70px] h-8 text-xs gap-1">
        <Globe className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code} className="text-xs">
            {l.flag} {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
