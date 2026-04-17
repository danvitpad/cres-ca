/** --- YAML
 * name: SettingsDrawer
 * description: Calendar settings — slot duration picker (5/10/15/30/60 min) + quick actions toggle. Auto-applies on change.
 * created: 2026-04-13
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Clock, Zap } from 'lucide-react';

type SettingsDrawerProps = {
  theme: 'light' | 'dark';
  initialScale?: number;
  initialQuickActions?: boolean;
  onApply?: (settings: { scale: number; quickActions: boolean }) => void;
};

const LIGHT = {
  text: '#1a1530',
  textMuted: '#64607a',
  border: 'rgba(124,58,237,0.13)',
  surface: '#ffffff',
  surfaceElevated: '#f8f6fd',
  accent: '#7c3aed',
  accentSoft: 'rgba(124,58,237,0.08)',
};

const DARK = {
  text: '#eae8f4',
  textMuted: '#a8a3be',
  border: 'rgba(139,92,246,0.16)',
  surface: '#111425',
  surfaceElevated: '#1a1d30',
  accent: '#8b5cf6',
  accentSoft: 'rgba(139,92,246,0.12)',
};

const SCALE_OPTIONS = [
  { idx: 0, label: '5 мин', desc: 'Самые точные слоты' },
  { idx: 1, label: '10 мин', desc: 'По умолчанию' },
  { idx: 2, label: '15 мин', desc: 'Стандарт' },
  { idx: 3, label: '30 мин', desc: 'Крупнее' },
  { idx: 4, label: '60 мин', desc: 'Только часы' },
];

export function SettingsDrawerContent({ theme, initialScale, initialQuickActions, onApply }: SettingsDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [scale, setScale] = useState(initialScale ?? 1);
  const [quickActions, setQuickActions] = useState(initialQuickActions ?? true);

  // Auto-apply on every change (no separate save button)
  useEffect(() => {
    onApply?.({ scale, quickActions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, quickActions]);

  return (
    <div style={{
      padding: '20px 16px',
      fontFamily: '"Inter Variable", "Inter", sans-serif',
      color: C.text,
    }}>
      {/* Slot duration */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 650, color: C.text, marginBottom: 4,
        }}>
          <Clock size={14} style={{ color: C.accent }} />
          Длительность слота
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
          Шаг сетки времени в календаре
        </div>

        {/* Pill grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 6,
        }}>
          {SCALE_OPTIONS.map(opt => {
            const active = scale === opt.idx;
            return (
              <button
                key={opt.idx}
                type="button"
                onClick={() => setScale(opt.idx)}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  border: `2px solid ${active ? C.accent : C.border}`,
                  background: active ? C.accent : C.surface,
                  color: active ? '#ffffff' : C.text,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8, textAlign: 'center' }}>
          {SCALE_OPTIONS[scale]?.desc}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 14px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.surfaceElevated,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: C.text,
          }}>
            <Zap size={13} style={{ color: C.accent }} />
            Быстрое создание
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, lineHeight: 1.4 }}>
            При клике по слоту сразу появляется меню действий
          </div>
        </div>
        <Switch
          checked={quickActions}
          onCheckedChange={setQuickActions}
        />
      </div>

      <div style={{
        marginTop: 16,
        padding: '10px 12px',
        borderRadius: 10,
        background: C.accentSoft,
        fontSize: 11,
        color: C.accent,
        textAlign: 'center',
        fontWeight: 500,
      }}>
        ✓ Изменения применяются автоматически
      </div>
    </div>
  );
}
