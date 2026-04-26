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

type Lang = 'ru' | 'uk' | 'en';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function MiniAppLanguagePage() {
  const { haptic } = useTelegram();
  const [current, setCurrent] = useState<Lang>('ru');
  const [busy, setBusy] = useState(false);

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
    // 1) Сохраняем в БД — desktop при следующей загрузке подхватит.
    try {
      await fetch('/api/me/ui-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_language: code }),
      });
    } catch { /* offline-tolerant */ }
    // 2) Cookie для немедленного применения на web (если пользователь
    //    вернётся туда, не дожидаясь полной перезагрузки).
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setBusy(false);
  }

  return (
    <SettingsShell title="Язык" subtitle="Синхронизируется с веб-дашбордом">
      <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white border-neutral-200 divide-y divide-neutral-200">
        {LANGS.map((l) => (
          <li key={l.code}>
            <button
              type="button"
              onClick={() => pick(l.code)}
              disabled={busy}
              className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-neutral-50 transition-colors disabled:opacity-60"
            >
              <span className="text-[20px]">{l.flag}</span>
              <span className="flex-1 text-left text-[14px] font-medium">{l.label}</span>
              {current === l.code && <Check size={16} weight="bold" className="text-violet-600" />}
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
