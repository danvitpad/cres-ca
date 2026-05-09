/** --- YAML
 * name: HapticToggle
 * description: Тумблер «Вибрация на тапах» для Mini App settings. Читает/пишет
 *              через useHapticPrefs (provider в корне Mini App layout).
 *              На tap ставит сразу значение в state и шлёт PATCH в /api/me/ui-prefs.
 * created: 2026-05-09
 * --- */

'use client';

import { motion } from 'framer-motion';
import { useHapticPrefs } from './haptic-provider';
import { useHaptic } from './use-haptic';
import { T, R, SPRING } from './design';

const TRACK_W = 44;
const TRACK_H = 26;
const KNOB = 22;

const I18N: Record<'ru' | 'uk' | 'en', { label: string; hint: string }> = {
  ru: { label: 'Вибрация на тапах', hint: 'Лёгкая отдача в Telegram при нажатиях' },
  uk: { label: 'Вібрація на дотик', hint: 'Легкий відгук у Telegram при натисканнях' },
  en: { label: 'Tap vibration', hint: 'Light haptic response in Telegram on taps' },
};

export function HapticToggle({ lang = 'ru' }: { lang?: 'ru' | 'uk' | 'en' }) {
  const { enabled, loaded, setEnabled } = useHapticPrefs();
  const { impact } = useHaptic();
  const t = I18N[lang];

  const onToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (next) impact('medium');
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!loaded}
      aria-pressed={enabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: T.surface,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: R.lg,
        textAlign: 'left',
        cursor: loaded ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{t.label}</span>
        <span style={{ fontSize: 13, color: T.textSecondary }}>{t.hint}</span>
      </div>
      <span
        aria-hidden
        style={{
          position: 'relative',
          flexShrink: 0,
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H,
          background: enabled ? T.accent : T.borderSubtle,
          transition: 'background 200ms ease',
        }}
      >
        <motion.span
          style={{
            position: 'absolute',
            top: 2,
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB,
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
          initial={false}
          animate={{ left: enabled ? TRACK_W - KNOB - 2 : 2 }}
          transition={SPRING.snappy}
        />
      </span>
    </button>
  );
}
