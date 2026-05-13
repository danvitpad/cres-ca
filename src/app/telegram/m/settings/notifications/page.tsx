/** --- YAML
 * name: MasterMiniAppSettings/Notifications
 * description: Настройки уведомлений для самого мастера — какие TG-пуши получать
 *              + кастомное время напоминаний о записи (дни/часы/минуты, до 10).
 *              Использует общий NotificationPreferencesEditor с темой "miniapp"
 *              для паритета с клиентом.
 * created: 2026-04-26
 * updated: 2026-05-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { NotificationPreferencesEditor } from '@/components/notifications/notification-preferences-editor';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
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
  title: string;
  sectionToggles: string;
  sectionTiming: string;
  footer: string;
  items: Record<keyof Prefs, { label: string; hint: string }>;
}> = {
  uk: {
    title: 'Сповіщення',
    sectionToggles: 'Що надсилати',
    sectionTiming: 'Коли нагадувати про візит',
    footer: 'Клієнтські розсилки — у «Маркетинг → Автоматика» (веб-кабінет).',
    items: {
      notif_birthdays:      { label: 'Дні народження клієнтів', hint: 'Ранковий пуш з ДН клієнтів і партнерів' },
      notif_appointments:   { label: 'Нагадування про візит',   hint: 'Перед записом (час — нижче)' },
      notif_new_clients:    { label: 'Новий підписник',         hint: 'Коли хтось додав вас в обране' },
      notif_payments:       { label: 'Платежі та скасування',   hint: 'Новий платіж, скасування з поверненням' },
      notif_marketing_tips: { label: 'Поради від AI',            hint: 'Раз на тиждень — як заробити більше' },
    },
  },
  ru: {
    title: 'Уведомления',
    sectionToggles: 'Что присылать',
    sectionTiming: 'Когда напоминать о визите',
    footer: 'Клиентские рассылки — в «Маркетинг → Автоматика» (веб-кабинет).',
    items: {
      notif_birthdays:      { label: 'Дни рождения клиентов',  hint: 'Утренний пуш с ДР клиентов и партнёров' },
      notif_appointments:   { label: 'Напоминание о визите',    hint: 'Перед записью (время — ниже)' },
      notif_new_clients:    { label: 'Новый клиент подписался', hint: 'Когда кто-то добавил вас в избранное' },
      notif_payments:       { label: 'Платежи и отмены',        hint: 'Новый платёж, отмена с возмещением' },
      notif_marketing_tips: { label: 'Советы от AI',            hint: 'Раз в неделю — как заработать больше' },
    },
  },
  en: {
    title: 'Notifications',
    sectionToggles: 'What to send',
    sectionTiming: 'When to remind about visits',
    footer: 'Client broadcasts — in «Marketing → Automation» (web cabinet).',
    items: {
      notif_birthdays:      { label: 'Client birthdays',     hint: 'Morning push with client/partner birthdays' },
      notif_appointments:   { label: 'Visit reminder',       hint: 'Before each appointment (timing — below)' },
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
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsBusy, setPrefsBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me/notif-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<Prefs> | null) => {
        if (data) setPrefs((p) => ({ ...p, ...data }));
      })
      .catch(() => { /* tolerant */ });
  }, []);

  async function togglePref(key: keyof Prefs) {
    if (prefsBusy) return;
    haptic('selection');
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefsBusy(true);
    try {
      await fetch('/api/me/notif-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
    } catch { /* tolerant */ }
    setPrefsBusy(false);
  }

  return (
    <MobilePage>
      <PageHeader title={t.title} />

      <div style={{ padding: `0 ${PAGE_PADDING_X}px 32px`, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ─── Что присылать (notif_* toggles) ─── */}
        <div>
          <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textTertiary, margin: '4px 4px 8px' }}>
            {t.sectionToggles}
          </p>
          <div style={{ background: T.surface, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, boxShadow: SHADOW.card, overflow: 'hidden' }}>
            {ITEM_ORDER.map((key, idx) => {
              const item = t.items[key];
              const on = prefs[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePref(key)}
                  disabled={prefsBusy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '13px 16px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderTop: idx === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0 }}>{item.label}</p>
                    <p style={{ ...TYPE.caption, color: T.textTertiary, margin: '2px 0 0' }}>{item.hint}</p>
                  </div>
                  <MiniToggle on={on} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Кастомное время напоминаний (offsets_minutes) ─── */}
        <div>
          <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textTertiary, margin: '4px 4px 8px' }}>
            {t.sectionTiming}
          </p>
          <NotificationPreferencesEditor theme="miniapp" />
        </div>

        <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 4px', lineHeight: 1.5 }}>
          {t.footer}
        </p>
      </div>
    </MobilePage>
  );
}

function MiniToggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        position: 'relative', width: 44, height: 26, borderRadius: 13, flexShrink: 0,
        background: on ? T.accent : T.bgSubtle,
        border: `1.5px solid ${on ? T.accent : T.border}`,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        left: on ? 21 : 3,
        transition: 'left 0.15s ease',
      }} />
    </div>
  );
}
