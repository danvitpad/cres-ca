/** --- YAML
 * name: MasterMiniAppSettings/Notifications
 * description: Настройки уведомлений для самого мастера — какие TG-пуши получать
 *              и за сколько времени приходит напоминание о записи (30 мин / 2 ч /
 *              24 ч / 2 дня). Два источника: profiles.notif_* + notification_preferences.
 * created: 2026-04-26
 * updated: 2026-05-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { getInitData } from '@/lib/telegram/webapp';
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

// Стандартные смещения в минутах и их метки
const OFFSET_OPTIONS = [
  { minutes: 30,   labelKey: 'offset30m' as const },
  { minutes: 120,  labelKey: 'offset2h'  as const },
  { minutes: 1440, labelKey: 'offset24h' as const },
  { minutes: 2880, labelKey: 'offset2d'  as const },
];

const I18N: Record<MiniAppLang, {
  title: string;
  sectionToggles: string;
  sectionTiming: string;
  timingHint: string;
  footer: string;
  offset30m: string; offset2h: string; offset24h: string; offset2d: string;
  items: Record<keyof Prefs, { label: string; hint: string }>;
}> = {
  uk: {
    title: 'Сповіщення',
    sectionToggles: 'Що надсилати',
    sectionTiming: 'Нагадування про запис',
    timingHint: 'За скільки часу до візиту прийде нагадування в Telegram',
    footer: 'Клієнтські розсилки та автоматизації — «Маркетинг → Автоматика» у веб-кабінеті.',
    offset30m: 'За 30 хв', offset2h: 'За 2 год', offset24h: 'За добу', offset2d: 'За 2 дні',
    items: {
      notif_birthdays:      { label: 'Дні народження клієнтів', hint: 'Ранковий пуш з ДН клієнтів і партнерів' },
      notif_appointments:   { label: 'Нагадування про візит',   hint: 'Перед кожним записом (час — нижче)' },
      notif_new_clients:    { label: 'Новий підписник',         hint: 'Коли хтось додав вас в обране' },
      notif_payments:       { label: 'Платежі та скасування',   hint: 'Новий платіж, скасування з поверненням' },
      notif_marketing_tips: { label: 'Поради від AI',            hint: 'Раз на тиждень — як заробити більше' },
    },
  },
  ru: {
    title: 'Уведомления',
    sectionToggles: 'Что присылать',
    sectionTiming: 'Напоминания о записи',
    timingHint: 'За сколько до визита придёт напоминание в Telegram',
    footer: 'Клиентские рассылки и автоматизации — «Маркетинг → Автоматика» в веб-кабинете.',
    offset30m: 'За 30 мин', offset2h: 'За 2 часа', offset24h: 'За сутки', offset2d: 'За 2 дня',
    items: {
      notif_birthdays:      { label: 'Дни рождения клиентов',  hint: 'Утренний пуш с ДР клиентов и партнёров' },
      notif_appointments:   { label: 'Напоминание о визите',    hint: 'Перед каждой записью (время — ниже)' },
      notif_new_clients:    { label: 'Новый клиент подписался', hint: 'Когда кто-то добавил вас в избранное' },
      notif_payments:       { label: 'Платежи и отмены',        hint: 'Новый платёж, отмена с возмещением' },
      notif_marketing_tips: { label: 'Советы от AI',            hint: 'Раз в неделю — как заработать больше' },
    },
  },
  en: {
    title: 'Notifications',
    sectionToggles: 'What to send',
    sectionTiming: 'Appointment reminders',
    timingHint: 'How far in advance to send a reminder to Telegram',
    footer: 'Client broadcasts and automations — «Marketing → Automation» in the web cabinet.',
    offset30m: '30 min before', offset2h: '2 hours before', offset24h: '1 day before', offset2d: '2 days before',
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

  // offsets_minutes из notification_preferences
  const [offsets, setOffsets] = useState<number[]>([1440, 120]);
  const [offsetsBusy, setOffsetsBusy] = useState(false);
  const [offsetsLoaded, setOffsetsLoaded] = useState(false);

  useEffect(() => {
    // Загружаем notif_* toggles
    fetch('/api/me/notif-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<Prefs> | null) => {
        if (data) setPrefs((p) => ({ ...p, ...data }));
      })
      .catch(() => { /* tolerant */ });

    // Загружаем offsets из notification_preferences
    const initData = getInitData();
    fetch('/api/me/notification-preferences', {
      headers: initData ? { 'X-TG-Init-Data': initData } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { offsets_minutes?: number[] } | null) => {
        if (data?.offsets_minutes) setOffsets(data.offsets_minutes);
        setOffsetsLoaded(true);
      })
      .catch(() => { setOffsetsLoaded(true); });
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

  async function toggleOffset(minutes: number) {
    if (offsetsBusy) return;
    haptic('selection');
    const isOn = offsets.includes(minutes);
    // Нельзя выключить последний активный
    if (isOn && offsets.length === 1) return;
    const next = isOn ? offsets.filter((m) => m !== minutes) : [...offsets, minutes];
    setOffsets(next);
    setOffsetsBusy(true);
    try {
      const initData = getInitData();
      await fetch('/api/me/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ offsets_minutes: next }),
      });
    } catch { /* tolerant */ }
    setOffsetsBusy(false);
  }

  return (
    <MobilePage>
      <PageHeader title={t.title} />

      <div style={{ padding: `0 ${PAGE_PADDING_X}px 32px`, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ─── Что присылать ─── */}
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

        {/* ─── Время напоминаний о записи ─── */}
        <div>
          <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textTertiary, margin: '4px 4px 8px' }}>
            {t.sectionTiming}
          </p>
          <div style={{ background: T.surface, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, boxShadow: SHADOW.card, padding: '14px 16px' }}>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '0 0 12px', lineHeight: 1.5 }}>
              {t.timingHint}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {OFFSET_OPTIONS.map(({ minutes, labelKey }) => {
                const on = offsetsLoaded && offsets.includes(minutes);
                const isLast = on && offsets.length === 1;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => toggleOffset(minutes)}
                    disabled={offsetsBusy || !offsetsLoaded || isLast}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '8px 14px', borderRadius: R.pill,
                      border: `1.5px solid ${on ? T.accent : T.border}`,
                      background: on ? T.accentSoft : T.surface,
                      color: on ? T.accent : T.textSecondary,
                      fontSize: 13, fontWeight: on ? 600 : 400,
                      cursor: isLast ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: !offsetsLoaded ? 0.4 : isLast ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {on && <Check size={12} strokeWidth={2.5} />}
                    {t[labelKey]}
                  </button>
                );
              })}
            </div>
          </div>
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
