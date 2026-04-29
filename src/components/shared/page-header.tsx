/** --- YAML
 * name: PageHeader
 * description: Fresha-style page header — title + count badge + description + action buttons (Варианты + Добавить)
 * --- */

'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

type PageHeaderProps = {
  title: string;
  count?: number;
  description?: string;
  onAdd?: () => void;
  addLabel?: string;
  onOptions?: () => void;
  children?: React.ReactNode;
};

const LIGHT = {
  text: '#000000',
  textMuted: '#737373',
  btnBg: '#000000',
  btnText: '#ffffff',
  btnOutlineBg: 'transparent',
  btnOutlineBorder: '#e5e5e5',
  badgeBg: '#f0f0f0',
  badgeText: '#737373',
};

const DARK = {
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  btnBg: 'var(--color-accent)',
  btnText: '#ffffff',
  btnOutlineBg: 'transparent',
  btnOutlineBorder: '#1a1a1a',
  badgeBg: '#000000',
  badgeText: '#8a8a8a',
};

export function PageHeader({ title, count, description, onAdd, addLabel = 'Добавить', onOptions, children }: PageHeaderProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ padding: '0 0 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: description ? 4 : 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h1>
          {count !== undefined && (
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.badgeText,
              backgroundColor: C.badgeBg,
              borderRadius: 999,
              padding: '2px 10px',
            }}>
              {count}
            </span>
          )}
        </div>
        {description && (
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>{description}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {children}
        {onOptions && (
          <button
            type="button"
            onClick={onOptions}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              border: `0.8px solid ${C.btnOutlineBorder}`,
              backgroundColor: C.btnOutlineBg,
              color: C.text,
              fontSize: 14,
              fontWeight: 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Варианты
            <ChevronDown style={{ width: 14, height: 14 }} />
          </button>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              height: 36,
              padding: '0 15px',
              borderRadius: 999,
              border: `0.8px solid ${C.btnBg}`,
              backgroundColor: C.btnBg,
              color: C.btnText,
              fontSize: 14,
              fontWeight: 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
