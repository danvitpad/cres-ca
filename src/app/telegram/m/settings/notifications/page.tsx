/** --- YAML
 * name: MasterMiniAppSettings/Notifications
 * description: Переключатели какие TG-пуши получает САМ мастер (про ДР клиентов,
 *              визиты, новых подписчиков, платежи, AI-советы). Не путать с
 *              «Язык исходящих уведомлений» — то про сообщения ДЛЯ клиентов.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { SettingsShell } from '@/components/miniapp/settings-shell';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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

const ITEMS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'notif_birthdays',      label: 'Дни рождения клиентов',  hint: 'Утренний пуш с ДР клиентов и партнёров' },
  { key: 'notif_appointments',   label: 'Напоминание о визите',    hint: 'За 30 минут — кто, что, заметки' },
  { key: 'notif_new_clients',    label: 'Новый клиент подписался', hint: 'Когда кто-то добавил тебя в избранное' },
  { key: 'notif_payments',       label: 'Платежи и отмены',        hint: 'Новый платёж, отмена с возмещением' },
  { key: 'notif_marketing_tips', label: 'Советы от AI',            hint: 'Раз в неделю — как заработать больше' },
];

export default function MiniAppNotificationsPage() {
  const { haptic } = useTelegram();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);

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
    <SettingsShell title="Уведомления" subtitle="Что присылать тебе в Telegram">
      <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-200">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex items-start gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium leading-tight">{item.label}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{item.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(item.key)}
              disabled={busy}
              role="switch"
              aria-checked={prefs[item.key]}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                prefs[item.key] ? 'bg-violet-500' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  prefs[item.key] ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      <p className="px-2 text-[11px] text-neutral-400">
        Клиентские рассылки и автоматизации настраиваются отдельно — в «Маркетинг → Автоматика»
        в веб-кабинете.
      </p>
    </SettingsShell>
  );
}
