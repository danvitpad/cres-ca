/** --- YAML
 * name: Settings Block + Field
 * description: Унифицированный визуальный стиль для всех вкладок /settings —
 *              чтобы Profile / WorkingHours / Loyalty / Notifications / прочие
 *              выглядели как продолжение страницы, а не как набор shadcn-карточек
 *              с другой палитрой. Использует тематические токены (usePageTheme C.*),
 *              без shadcn Card / Accordion / Switch.
 * created: 2026-04-26
 * --- */

'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { FONT, FONT_FEATURES, type PageTheme } from '@/lib/dashboard-theme';

/** Карточка-секция с заголовком, опциональным сабтайтлом и контентом. */
export function SettingsBlock({
  title,
  subtitle,
  C,
  children,
  collapsible = false,
  defaultOpen = true,
  right,
}: {
  title: string;
  subtitle?: string;
  C: PageTheme;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = collapsible ? open : true;

  return (
    <section
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 0,
        fontFamily: FONT,
        fontFeatureSettings: FONT_FEATURES,
      }}
    >
      <header
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: collapsible ? 'pointer' : 'default',
          borderBottom: expanded ? `1px solid ${C.border}` : 'none',
        }}
        onClick={() => collapsible && setOpen((v) => !v)}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: C.text, lineHeight: 1.2 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
              {subtitle}
            </div>
          )}
        </div>
        {right}
        {collapsible && (
          <ChevronDown
            size={16}
            style={{
              color: C.textTertiary,
              transition: 'transform 200ms ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
          />
        )}
      </header>
      {expanded && (
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Поле формы с label сверху и input/контролом снизу. Стилизовано под C-токены. */
export function SettingsField({
  label,
  hint,
  C,
  children,
  span = 1,
}: {
  label?: string;
  hint?: string;
  C: PageTheme;
  children: React.ReactNode;
  span?: 1 | 2 | 3;
}) {
  return (
    <div style={{ gridColumn: span === 1 ? undefined : `span ${span}`, minWidth: 0 }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: C.textSecondary,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {label}
        </div>
      )}
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/** Стиль базового input/textarea — соответствует тематическим токенам. */
export function settingsInputStyle(C: PageTheme): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: C.surfaceElevated,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: 14,
    fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

/** Сегментный селектор (radio-like). */
export function SettingsSegmented<T extends string>({
  value,
  onChange,
  options,
  C,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  C: PageTheme;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: C.surfaceElevated,
        border: `1px solid ${C.border}`,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: 'none',
              background: active ? C.accent : 'transparent',
              color: active ? '#fff' : C.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'all 120ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle-switch, без shadcn зависимости. */
export function SettingsSwitch({
  checked,
  onChange,
  C,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  C: PageTheme;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: checked ? C.accent : C.border,
        transition: 'background 120ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 160ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

/** Главная кнопка действий. */
export function SettingsButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  C,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  C: PageTheme;
}) {
  const styles: Record<typeof variant, React.CSSProperties> = {
    primary: { background: C.accent, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    danger: { background: C.dangerSoft, color: C.danger, border: `1px solid ${C.danger}33` },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '10px 18px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: FONT,
      }}
    >
      {children}
    </button>
  );
}
