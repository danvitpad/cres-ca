/** --- YAML
 * name: MasterMiniAppSettings/Language
 * description: Mobile language selector for Mini App master. Changes locale cookie + reloads.
 * created: 2026-04-20
 * --- */

'use client';

import { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { SettingsShell } from '@/components/miniapp/settings-shell';

const LANGS = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function MiniAppLanguagePage() {
  const { haptic } = useTelegram();
  const [current, setCurrent] = useState<string>(() => {
    if (typeof window === 'undefined') return 'ru';
    const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    return m?.[1] ?? 'ru';
  });

  function pick(code: string) {
    haptic('selection');
    setCurrent(code);
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
    // Reload dashboard paths; miniapp is RU-only so just refresh.
    setTimeout(() => window.location.reload(), 200);
  }

  return (
    <SettingsShell title="Язык" subtitle="Применяется к веб-версии и письмам">
      <ul className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/10">
        {LANGS.map((l) => (
          <li key={l.code}>
            <button
              onClick={() => pick(l.code)}
              className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-white/[0.06] transition-colors"
            >
              <span className="text-[20px]">{l.flag}</span>
              <span className="flex-1 text-left text-[14px] font-medium">{l.label}</span>
              {current === l.code && <Check size={16} weight="bold" className="text-violet-300" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="px-2 text-[11px] text-white/40">
        Mini App интерфейс сейчас только на русском — смена языка влияет на веб-дашборд и уведомления.
      </p>
    </SettingsShell>
  );
}
