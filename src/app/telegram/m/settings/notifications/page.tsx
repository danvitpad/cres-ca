/** --- YAML
 * name: MasterMiniAppSettings/Notifications
 * description: Переключатели какие TG-пуши получает САМ мастер (про ДР клиентов,
 *              визиты, новых подписчиков, платежи, AI-советы). Не путать с
 *              «Язык исходящих уведомлений» — то про сообщения ДЛЯ клиентов.
 *              Локализован uk/ru/en через useMiniAppLocale (2026-05-06).
 * created: 2026-04-26
 * updated: 2026-05-06
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { SettingsShell } from '@/components/miniapp/settings-shell';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Prefs {
  notif_birthdays: boolean;
  notif_appointments: boolean;
  notif_new_clients: boolean;
  notif_payments: boolean;
  notif_marketing_tips: boolean;
}

const DEFAULT_PREFS: Prefs = {
  notif_birthdays: true,
  notif_appointments: true,
  notif_new_clients: true,
  notif_payments: true,
  notif_marketing_tips: false,
};

const I18N: Record<MiniAppLang, {
  pageTitle: string; pageSubtitle: string;
  footer: string;
  items: Record<keyof Prefs, { label: string; hint: string }>;
}> = {
  uk: {
    pageTitle: 'Сповіщення',
    pageSubtitle: 'Що надсилати вам в Telegram',
    footer: 'Клієнтські розсилки та автоматизації налаштовуються окремо — у «Маркетинг → Автоматика» у веб-кабінеті.',
    items: {
      notif_birthdays:      { label: 'Дні народження клієнтів', hint: 'Ранковий пуш з ДН клієнтів і партнерів' },
      notif_appointments:   { label: 'Нагадування про візит',   hint: 'За 30 хвилин — хто, що, нотатки' },
      notif_new_clients:    { label: 'Новий підписник',         hint: 'Коли хтось додав вам в обране' },
      notif_payments:       { label: 'Платежі та скасування',   hint: 'Новий платіж, скасування з поверненням' },
      notif_marketing_tips: { label: 'Поради від AI',            hint: 'Раз на тиждень — як заробити більше' },
    },
  },
  ru: {
    pageTitle: 'Уведомления',
    pageSubtitle: 'Что присылать вам в Telegram',
    footer: 'Клиентские рассылки и автоматизации настраиваются отдельно — в «Маркетинг → Автоматика» в веб-кабинете.',
    items: {
      notif_birthdays:      { label: 'Дни рождения клиентов',  hint: 'Утренний пуш с ДР клиентов и партнёров' },
      notif_appointments:   { label: 'Напоминание о визите',    hint: 'За 30 минут — кто, что, заметки' },
      notif_new_clients:    { label: 'Новый клиент подписался', hint: 'Когда кто-то добавил вас в избранное' },
      notif_payments:       { label: 'Платежи и отмены',        hint: 'Новый платёж, отмена с возмещением' },
      notif_marketing_tips: { label: 'Советы от AI',            hint: 'Раз в неделю — как заработать больше' },
    },
  },
  en: {
    pageTitle: 'Notifications',
    pageSubtitle: 'What to send you in Telegram',
    footer: 'Client broadcasts and automations are set up separately — in «Marketing → Automation» in the web cabinet.',
    items: {
      notif_birthdays:      { label: 'Client birthdays',     hint: 'Morning push with client/partner birthdays' },
      notif_appointments:   { label: 'Visit reminder',       hint: '30 minutes ahead — who, what, notes' },
      notif_new_clients:    { label: 'New follower',         hint: 'When someone adds you to favorites' },
      notif_payments:       { label: 'Payments & cancels',   hint: 'New payment, cancel with refund' },
      notif_marketing_tips: { label: 'AI tips',              hint: 'Weekly — how to earn more' },
    },
  },
};

const ITEM_ORDER: Array<keyof Prefs> = [
  'notif_birthdays',
  'notif_appointments',
  'notif_new_clients',
  'notif_payments',
  'notif_marketing_tips',
];

export default function MiniAppNotificationsPage() {
  const { haptic } = useTelegram();
  const { theme } = useMiniAppTheme();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);

  const cardBg = theme === 'dark' ? '#1a1a1d' : '#ffffff';
  const cardBorder = theme === 'dark' ? '#27272a' : '#e5e5e7';
  const dividerColor = theme === 'dark' ? '#27272a' : '#e5e5e7';
  const titleColor = theme === 'dark' ? '#fafafa' : '#0a0a0a';
  const hintColor = theme === 'dark' ? '#a1a1aa' : '#71717a';

  useEffect(() => {
    fetch('/api/me/notif-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<Prefs> | null) => {
        if (!data) return;
        setPrefs((p) => ({ ...p, ...data }));
      })
      .catch(() => { /* tolerant */ });
  }, []);

  async function toggle(key: keyof Prefs) {
    if (busy) return;
    haptic('selection');
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setBusy(true);
    try {
      await fetch('/api/me/notif-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
    } catch { /* tolerant */ }
    setBusy(false);
  }

  return (
    <SettingsShell title={t.pageTitle} subtitle={t.pageSubtitle}>
      <ul
        className="overflow-hidden rounded-2xl"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        {ITEM_ORDER.map((key, idx) => {
          const item = t.items[key];
          return (
            <li
              key={key}
              className="flex items-start gap-3 px-4 py-3.5"
              style={idx === 0 ? undefined : { borderTop: `1px solid ${dividerColor}` }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-tight" style={{ color: titleColor }}>{item.label}</p>
                <p className="mt-1 text-[11px]" style={{ color: hintColor }}>{item.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(key)}
                disabled={busy}
                role="switch"
                aria-checked={prefs[key]}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  prefs[key] ? 'bg-[var(--m-accent)]' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                    prefs[key] ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-2 text-[11px] text-neutral-400">
        {t.footer}
      </p>
    </SettingsShell>
  );
}
