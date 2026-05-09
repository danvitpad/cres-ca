/** --- YAML
 * name: MasterMiniAppSettings/Language
 * description: Выбор UI-языка. Пишется в profiles.ui_language через /api/me/ui-prefs,
 *              чтобы desktop при следующей загрузке подхватил тот же выбор. Cookie тоже
 *              обновляем — для случая когда пользователь возвращается на web сразу.
 * created: 2026-04-20
 * updated: 2026-04-26
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from '@phosphor-icons/react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { SettingsShell } from '@/components/miniapp/settings-shell';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { useMiniAppLocale, setMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

type Lang = MiniAppLang;

const LANGS: { code: Lang; label: string }[] = [
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const I18N: Record<Lang, { title: string; subtitle: string; footer: string }> = {
  uk: {
    title: 'Мова',
    subtitle: 'Синхронізується з веб-кабінетом',
    footer: 'Впливає на мову інтерфейсу в Mini App і веб-кабінеті. Мова повідомлень клієнтам — окрема настройка в «Редагувати профіль».',
  },
  ru: {
    title: 'Язык',
    subtitle: 'Синхронизируется с веб-кабинетом',
    footer: 'Влияет на язык интерфейса в Mini App и веб-кабинете. Язык уведомлений клиентам — отдельная настройка в «Редактировать профиль».',
  },
  en: {
    title: 'Language',
    subtitle: 'Synced with web cabinet',
    footer: 'Affects Mini App and web cabinet UI language. Client notifications language — separate setting in «Edit profile».',
  },
};

export default function MiniAppLanguagePage() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { theme } = useMiniAppTheme();
  // current = lang из хука (реактивно). Никаких useEffect+fetch — это
  // вызывало гонку с локальным state и галочка возвращалась на старое.
  const current = useMiniAppLocale();
  const t = I18N[current];
  const [busy, setBusy] = useState(false);

  const cardBg = theme === 'dark' ? '#1a1a1d' : '#ffffff';
  const cardBorder = theme === 'dark' ? '#27272a' : '#e5e5e7';
  const dividerColor = theme === 'dark' ? '#27272a' : '#e5e5e7';
  const labelColor = theme === 'dark' ? '#fafafa' : '#0a0a0a';

  async function pick(code: Lang) {
    if (code === current || busy) return;
    haptic('selection');
    setBusy(true);

    // Hot-swap: localStorage + cookie + dispatch event.
    // useMiniAppLocale через event обновится → current = code → галочка
    // переедет, заголовок переключится через I18N[current].
    setMiniAppLocale(code);
    router.refresh();

    fetch('/api/me/ui-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_language: code }),
    }).catch(() => { /* offline-tolerant */ });

    setTimeout(() => setBusy(false), 250);
  }

  return (
    <SettingsShell title={t.title} subtitle={t.subtitle}>
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
              <span className="flex-1 text-left text-[14px] font-medium">{l.label}</span>
              {current === l.code && <Check size={16} weight="bold" className="text-teal-500" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="px-2 text-[11px] text-neutral-400">{t.footer}</p>
    </SettingsShell>
  );
}
