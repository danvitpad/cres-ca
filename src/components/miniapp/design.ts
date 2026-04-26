/** --- YAML
 * name: MiniAppDesign
 * description: Премиум-дизайн-система для всех Mini App ролей (клиент / мастер / команда).
 *              Источник правды для палитры, типографики, тени, радиусов и анимаций.
 *              Стиль — Fresha 2026: чистый минимализм на светлом фоне, мягкие тени,
 *              насыщенный фиолетовый акцент, premium-карточки с реальными фото.
 * created: 2026-04-26
 * --- */

import type { CSSProperties } from 'react';

/** Базовая палитра. Тёмная тема — отдельный набор; в первой итерации — светлая. */
export const T = {
  // Surfaces
  bg: '#ffffff',
  bgSubtle: '#f5f6f8',
  surface: '#ffffff',
  surfaceElevated: '#fafafa',
  border: '#e5e7ea',
  borderSubtle: '#eef0f2',

  // Text
  text: '#0a0a0c',
  textSecondary: '#4b5260',
  textTertiary: '#8a91a0',
  textDisabled: '#bdc2cc',

  // Accent (Fresha purple-ish)
  accent: '#6c5ce7',
  accentHover: '#5847d4',
  accentSoft: '#efedfd',
  accentText: '#ffffff',

  // Hero gradient (purple → pink)
  gradientFrom: '#6c5ce7',
  gradientVia: '#8b6cf2',
  gradientTo: '#e879f9',

  // Status
  success: '#10b981',
  successSoft: '#dcfce7',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',

  // Category accents (для tile-cards на home)
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
