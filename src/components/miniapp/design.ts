/** --- YAML
 * name: MiniAppDesign
 * description: Премиум-дизайн-система для всех Mini App ролей (клиент / мастер / команда).
 *              Источник правды для палитры, типографики, тени, радиусов и анимаций.
 *              Стиль — Fresha 2026: чистый минимализм на светлом фоне, мягкие тени,
 *              насыщенный фиолетовый акцент, premium-карточки с реальными фото.
 * created: 2026-04-26
 * --- */

import type { CSSProperties } from 'react';

/** Палитра — токены через CSS-переменные. Light/dark переключаются ОДНОВРЕМЕННО
 *  для всех Mini App ролей (клиент / мастер / админ салона) через `data-theme=dark`
 *  на корневом контейнере (см. ThemeBoundary в miniapp/theme.tsx). Категории остаются
 *  hardcoded — их акценты в обеих темах одинаковы, потому что они UI-«тэги», а не
 *  цвета фона. */
export const T = {
  // Surfaces
  bg: 'var(--m-bg)',
  bgSubtle: 'var(--m-bg-subtle)',
  surface: 'var(--m-surface)',
  surfaceElevated: 'var(--m-surface-elevated)',
  border: 'var(--m-border)',
  borderSubtle: 'var(--m-border-subtle)',

  // Text
  text: 'var(--m-text)',
  textSecondary: 'var(--m-text-secondary)',
  textTertiary: 'var(--m-text-tertiary)',
  textDisabled: 'var(--m-text-disabled)',

  // Accent (Fresha purple-ish)
  accent: 'var(--m-accent)',
  accentHover: 'var(--m-accent-hover)',
  accentSoft: 'var(--m-accent-soft)',
  accentText: 'var(--m-accent-text)',

  // Hero gradient (purple → pink) — фиксированные цвета, фоны hero одинаковые в обеих темах
  gradientFrom: '#0d9488',
  gradientVia: '#8b6cf2',
  gradientTo: '#e879f9',

  // Status
  success: 'var(--m-success)',
  successSoft: 'var(--m-success-soft)',
  warning: 'var(--m-warning)',
  warningSoft: 'var(--m-warning-soft)',
  danger: 'var(--m-danger)',
  dangerSoft: 'var(--m-danger-soft)',

  // Category accents — hardcoded (одинаковые в обеих темах)
  categoryYellow: '#f4b740',
  categoryBlue: '#3b82f6',
  categoryPink: '#ec4899',
  categoryTeal: '#14b8a6',
  categoryOrange: '#f97316',
  categoryGreen: '#84cc16',
  categoryViolet: '#a855f7',
  categoryRed: '#f43f5e',
} as const;

/** Радиусы — премиум pill / card, не «маленькие квадратные» 4-8px */
export const R = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

/** Типографика — bold как у Fresha, плотный leading */
export const FONT_STACK =
  '"SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
export const FONT_FEATURES = '"cv02","cv03","cv04","cv11","ss01"';

export const TYPE = {
  /** Главный заголовок страницы — Fresha «Действие» / «Для вас» */
  h1: { fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 } as CSSProperties,
  /** Section title — «Топ мастеров» */
  h2: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 } as CSSProperties,
  /** Card title — название мастера */
  h3: { fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25 } as CSSProperties,
  body: { fontSize: 15, fontWeight: 400, letterSpacing: 0, lineHeight: 1.45 } as CSSProperties,
  bodyStrong: { fontSize: 15, fontWeight: 600, lineHeight: 1.4 } as CSSProperties,
  caption: { fontSize: 13, fontWeight: 400, letterSpacing: 0, lineHeight: 1.4, color: T.textSecondary } as CSSProperties,
  micro: { fontSize: 11, fontWeight: 500, letterSpacing: '0.02em', lineHeight: 1.3, color: T.textTertiary } as CSSProperties,
} as const;

/** Тени — мягкие, как у нативных iOS-карточек */
export const SHADOW = {
  none: 'none',
  card: '0 1px 2px rgba(15,18,24,0.04), 0 4px 12px rgba(15,18,24,0.04)',
  cardHover: '0 2px 4px rgba(15,18,24,0.06), 0 8px 24px rgba(15,18,24,0.08)',
  elevated: '0 4px 12px rgba(15,18,24,0.08), 0 12px 32px rgba(15,18,24,0.10)',
  /** Floating bottom nav */
  navBar: '0 -2px 12px rgba(15,18,24,0.04), 0 4px 24px rgba(15,18,24,0.10)',
  /** Floating action pill (search bar over map) */
  pill: '0 4px 16px rgba(15,18,24,0.12)',
} as const;

/** Анимации — мягкие spring-y кривые. Используются framer-motion. */
export const SPRING = {
  /** Default scale/translate spring */
  default: { type: 'spring' as const, stiffness: 320, damping: 32 },
  /** Snappy для кнопок */
  snappy: { type: 'spring' as const, stiffness: 480, damping: 30 },
  /** Soft для page transitions */
  soft: { type: 'spring' as const, stiffness: 220, damping: 28 },
} as const;

/** Геометрия — стандартный padding страницы под Mini App шириной 390px */
export const PAGE_PADDING_X = 20;
export const PAGE_GAP = 24;

/** Hero gradient как inline-стиль */
export const HERO_GRADIENT: CSSProperties = {
  background: `linear-gradient(125deg, ${T.gradientFrom} 0%, ${T.gradientVia} 50%, ${T.gradientTo} 100%)`,
};

/** Inline base font для root элемента страниц Mini App */
export const FONT_BASE: CSSProperties = {
  fontFamily: FONT_STACK,
  fontFeatureSettings: FONT_FEATURES,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
};
