/** --- YAML
 * name: MasterMiniAppSettings/Language
 * description: Выбор UI-языка. Пишется в profiles.ui_language через /api/me/ui-prefs,
 *              чтобы desktop при следующей загрузке подхватил тот же выбор. Cookie тоже
 *              обновляем — для случая когда пользователь возвращается на web сразу.
 * created: 2026-04-20
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { SettingsShell } from '@/components/miniapp/settings-shell';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { setMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'ru' | 'uk' | 'en';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function MiniAppLanguagePage() {
  const { haptic } = useTelegram();
  const { theme } = useMiniAppTheme();
  const [current, setCurrent] = useState<Lang>('uk');
  const [busy, setBusy] = useState(false);

  const cardBg = theme === 'dark' ? '#1a1a1d' : '#ffffff';
  const cardBorder = theme === 'dark' ? '#27272a' : '#e5e5e7';
  const dividerColor = theme === 'dark' ? '#27272a' : '#e5e5e7';
  const labelColor = theme === 'dark' ? '#fafafa' : '#0a0a0a';

  // Подтягиваем сохранённое значение из БД, чтобы переключатель показал
  // настоящее текущее состояние (а не дефолтный 'ru').
  useEffect(() => {
    fetch('/api/me/ui-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ui_language?: Lang } | null) => {
        if (data?.ui_language) setCurrent(data.ui_language);
      })
      .catch(() => { /* offline-tolerant */ });
  }, []);

  async function pick(code: Lang) {
    if (code === current || busy) return;
    haptic('selection');
    setBusy(true);
    setCurrent(code);

    // Hot-swap: localStorage + cookie + событие → все компоненты
    // через useMiniAppLocale моментально перерисуются. Без перезагрузки.
    setMiniAppLocale(code);

    // DB save в фоне.
    fetch('/api/me/ui-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_language: code }),
    }).catch(() => { /* offline-tolerant */ });

    setTimeout(() => setBusy(false), 250);
  }

  return (
    <SettingsShell title="Язык" subtitle="Синхронизируется с веб-дашбордом">
      <ul
        className="overflow-hidden rounded-2xl"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        {LANGS.map((l, i) => (
          <li key={l.code} style={i === 0 ? undefined : { borderTop: `1px solid ${dividerColor}` }}>
            <button
              type="button"
              onClick={() => pick(l.code)}
              disabled={busy}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-opacity disabled:opacity-60"
              style={{ color: labelColor }}
            >
              <span className="text-[20px]">{l.flag}</span>
              <span className="flex-1 text-left text-[14px] font-medium">{l.label}</span>
              {current === l.code && <Check size={16} weight="bold" className="text-teal-500" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="px-2 text-[11px] text-neutral-400">
        Влияет на язык интерфейса в Mini App и web-кабинете. Для языка уведомлений клиентам —
        отдельная настройка в «Редактировать профиль».
      </p>
    </SettingsShell>
  );
}
