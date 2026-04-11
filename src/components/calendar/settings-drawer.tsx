/** --- YAML
 * name: SettingsDrawer
 * description: Fresha-style calendar settings drawer — scale slider + quick actions toggle
 * --- */

'use client';

import { useState } from 'react';

type SettingsDrawerProps = {
  theme: 'light' | 'dark';
  onApply?: (settings: { scale: number; quickActions: boolean }) => void;
};

const LIGHT = {
  text: '#0d0d0d',
  textMuted: '#737373',
  border: '#e5e5e5',
  sliderTrack: '#e5e5e5',
  sliderThumb: '#0d0d0d',
  toggleActive: '#6950f3',
  toggleInactive: '#d4d4d4',
  btnBg: '#0d0d0d',
  btnText: '#ffffff',
};

const DARK = {
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  border: '#2a2a2a',
  sliderTrack: '#3a3a3a',
  sliderThumb: '#e5e5e5',
  toggleActive: '#8b7cf6',
  toggleInactive: '#4a4a4a',
  btnBg: '#6950f3',
  btnText: '#ffffff',
};

export function SettingsDrawerContent({ theme, onApply }: SettingsDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [scale, setScale] = useState(3);
  const [quickActions, setQuickActions] = useState(true);

  const scaleLabels = ['5 мин', '10 мин', '15 мин', '30 мин', '60 мин'];

  return (
    <div style={{ padding: '24px 16px' }}>
      {/* Calendar Scale */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          Масштаб календаря
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
          Выберите интервал временных слотов
        </div>
        <input
          type="range"
          min={0}
          max={4}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: C.toggleActive,
            cursor: 'pointer',
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: C.textMuted,
          marginTop: 4,
        }}>
          {scaleLabels.map((label, i) => (
            <span key={label} style={{ fontWeight: i === scale ? 600 : 400, color: i === scale ? C.text : C.textMuted }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Actions Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        borderTop: `0.8px solid ${C.border}`,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
            Показывать быстрые действия
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
            Быстрое создание записи при клике на слот
          </div>
        </div>
        <button
          type="button"
          onClick={() => setQuickActions(!quickActions)}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            backgroundColor: quickActions ? C.toggleActive : C.toggleInactive,
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 200ms',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#ffffff',
            position: 'absolute',
            top: 2,
            left: quickActions ? 22 : 2,
            transition: 'left 200ms',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {/* Apply Button */}
      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={() => onApply?.({ scale, quickActions })}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 999,
            border: 'none',
            backgroundColor: C.btnBg,
            color: C.btnText,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Применить изменения
        </button>
      </div>
    </div>
  );
}
