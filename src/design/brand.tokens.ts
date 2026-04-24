/** --- YAML
 * name: Brand tokens — source of truth
 * description: >
 *   Все visual-значения проекта в одном файле. Редактируя этот файл,
 *   ты меняешь визуал ВСЕГО проекта (через CSS vars + Tailwind).
 *   Запрещено hardcoded'ить hex/px в components.
 *
 * HOW TO EDIT:
 *   1. Поменяй значение здесь (hex / px / timing)
 *   2. npm run build (или push в main — Vercel сделает сам)
 *   3. Весь UI обновится
 *
 *   Просить AI: "Сделай accent темнее на 10%", "замени font на Inter"
 *   — AI правит только этот файл.
 * --- */

// ══════════════════════ 1. COLORS ══════════════════════

export const colors = {
  accent: {
    DEFAULT: '#7c3aed',
    hover:   '#6d28d9',
    active:  '#5b21b6',
    soft:    'rgba(124, 58, 237, 0.1)',
    border:  'rgba(124, 58, 237, 0.3)',
    text:    '#c4b5fd',  // for use on dark bg
  },

  dark: {
    bg:          '#0b0d17',
    surface:     '#1a1b20',
    surface2:    'rgba(255, 255, 255, 0.03)',
    surface3:    'rgba(255, 255, 255, 0.06)',
    border:      'rgba(255, 255, 255, 0.1)',
    borderHover: 'rgba(255, 255, 255, 0.2)',
    text:        '#ffffff',
    text2:       'rgba(255, 255, 255, 0.7)',
    text3:       'rgba(255, 255, 255, 0.4)',
    text4:       'rgba(255, 255, 255, 0.25)', // placeholder
  },

  light: {
    bg:          '#f8f9fc',
    surface:     '#ffffff',
    surface2:    '#f4f4f6',
    surface3:    '#e9ebef',
    border:      '#e5e7eb',
    borderHover: '#d1d5db',
    text:        '#0b0d17',
    text2:       '#4a5568',
    text3:       '#9ca3af',
    text4:       '#d1d5db',
  },

  success: { DEFAULT: '#10b981', soft: 'rgba(16, 185, 129, 0.1)',  border: 'rgba(16, 185, 129, 0.3)', text: '#6ee7b7' },
  warning: { DEFAULT: '#f59e0b', soft: 'rgba(245, 158, 11, 0.1)',  border: 'rgba(245, 158, 11, 0.3)', text: '#fcd34d' },
  danger:  { DEFAULT: '#ef4444', soft: 'rgba(239, 68, 68, 0.1)',   border: 'rgba(239, 68, 68, 0.3)',  text: '#fca5a5' },
  info:    { DEFAULT: '#3b82f6', soft: 'rgba(59, 130, 246, 0.1)',  border: 'rgba(59, 130, 246, 0.3)', text: '#93c5fd' },
} as const;

// ══════════════════════ 2. TYPOGRAPHY ══════════════════════

export const typography = {
  fontFamily: {
    sans: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'JetBrains Mono, Menlo, monospace',
    pdf:  'PT Sans', // cyrillic-capable for PDF generation
  },
  fontFeatureSettings: '"ss01", "cv11", "cv02"',

  // Scale — размер, line-height, weight (в кортежах для Tailwind fontSize)
  scale: {
    xs:   ['11px', { lineHeight: '14px', fontWeight: '500' }],
    sm:   ['12px', { lineHeight: '16px', fontWeight: '500' }],
    base: ['13px', { lineHeight: '18px', fontWeight: '500' }],
    md:   ['14px', { lineHeight: '20px', fontWeight: '550' }],
    lg:   ['16px', { lineHeight: '22px', fontWeight: '600' }],
    xl:   ['19px', { lineHeight: '24px', fontWeight: '650' }],
    '2xl':['22px', { lineHeight: '28px', fontWeight: '700' }],
    '3xl':['28px', { lineHeight: '34px', fontWeight: '700' }],
    '4xl':['40px', { lineHeight: '48px', fontWeight: '800' }],
    '5xl':['56px', { lineHeight: '60px', fontWeight: '800' }],
  },

  letterSpacing: {
    tighter: '-0.04em',
    tight:   '-0.02em',
    normal:  '0',
    wide:    '0.02em',
    wider:   '0.04em',
    widest:  '0.08em',
  },
} as const;

// ══════════════════════ 3. SPACING ══════════════════════

export const spacing = {
  0:    '0',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  10:   '40px',
  12:   '48px',
  14:   '56px',
  16:   '64px',
  20:   '80px',
  24:   '96px',
} as const;

// ══════════════════════ 4. RADIUS ══════════════════════

export const radius = {
  none: '0',
  sm:   '6px',
  md:   '10px',
  lg:   '14px',
  xl:   '20px',
  '2xl':'28px',
  full: '9999px',
} as const;

// ══════════════════════ 5. SHADOWS ══════════════════════

export const shadow = {
  none: 'none',
  sm:   '0 1px 2px rgba(0, 0, 0, 0.05)',
  md:   '0 4px 8px rgba(0, 0, 0, 0.1)',
  lg:   '0 8px 24px rgba(0, 0, 0, 0.15)',
  xl:   '0 16px 48px rgba(0, 0, 0, 0.5)',
  glow: '0 0 0 3px rgba(124, 58, 237, 0.2)', // focus ring, brand-coloured
} as const;

// ══════════════════════ 6. MOTION ══════════════════════

export const motion = {
  duration: {
    instant: '80ms',
    fast:    '150ms',
    base:    '240ms',
    slow:    '400ms',
  },
  easing: {
    standard: 'cubic-bezier(0.23, 1, 0.32, 1)',
    entry:    'cubic-bezier(0, 0, 0.2, 1)',
    exit:     'cubic-bezier(0.4, 0, 1, 1)',
  },
  spring: {
    fast:     { type: 'spring' as const, stiffness: 280, damping: 24, mass: 0.8 },
    standard: { type: 'spring' as const, stiffness: 180, damping: 26, mass: 0.8 },
    bouncy:   { type: 'spring' as const, stiffness: 200, damping: 14, mass: 0.9 },
  },
} as const;

// ══════════════════════ 7. BREAKPOINTS ══════════════════════

export const breakpoints = {
  sm:  '640px',
  md:  '768px',
  lg:  '1024px',
  xl:  '1280px',
  '2xl':'1536px',
} as const;

// ══════════════════════ 8. Z-INDEX ══════════════════════

export const zIndex = {
  base:     '0',
  dropdown: '10',
  sticky:   '20',
  fixed:    '30',
  overlay:  '40',
  modal:    '50',
  toast:    '60',
  tooltip:  '70',
} as const;

// ══════════════════════ 9. COMPONENT TOKENS ══════════════════════
// Компонент-специфичные токены — используются в CVA variants

export const component = {
  button: {
    height: { sm: '32px', md: '40px', lg: '48px' },
    padding: {
      sm: { y: spacing[1.5], x: spacing[3] },
      md: { y: spacing[2.5], x: spacing[4] },
      lg: { y: spacing[3.5], x: spacing[6] },
    },
    iconSize:   { sm: '12px', md: '14px', lg: '18px' },
    iconGap:    { sm: '4px',  md: '6px',  lg: '8px'  },
    radius:     radius.lg,
    fontWeight: '600',
  },

  input: {
    height:  '46px',
    padding: { y: spacing[3], x: spacing[4] },
    radius:  radius.md,
    fontSize: typography.scale.base[0],
  },

  card: {
    padding: { mobile: spacing[4], desktop: spacing[6] },
    radius:  radius.lg,
    border:  `1px solid ${colors.dark.border}`,
    bg:      colors.dark.surface2,
  },

  modal: {
    padding:  spacing[5],
    radius:   radius.xl,
    maxWidth: { default: '480px', large: '640px' },
    shadow:   shadow.xl,
  },

  tabs: {
    containerPadding: spacing[1],
    itemPadding: { y: spacing[2], x: spacing[3] },
    itemRadius:  radius.md,
    gap:         spacing[0.5],
  },

  tapTarget: {
    min: '44px', // iOS/Android минимальная tap-зона
  },

  container: {
    maxWidth: '1280px',
    padding: {
      mobile: 'clamp(16px, 4vw, 24px)',
      desktop: 'clamp(24px, 3vw, 36px)',
    },
  },
} as const;

// ══════════════════════ EXPORT (для tailwind.config.ts) ══════════════════════

export const tokens = { colors, typography, spacing, radius, shadow, motion, breakpoints, zIndex, component };
export default tokens;
