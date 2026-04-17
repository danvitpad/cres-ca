/** --- YAML
 * name: Dashboard Theme
 * description: Single source of truth for ALL dashboard styling — layout, pages, cards, tables, badges.
 *              Based on Linear.app design system. Every dashboard page MUST import from here.
 *              NO page-level LIGHT/DARK objects. NO Tailwind for page content. NO Roobert PRO.
 * created: 2026-04-16
 * updated: 2026-04-17
 * --- */

/* ─── Font ─── */
export const FONT = '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const FONT_FEATURES = '"cv01", "ss03"';

/* ─── Layout tokens (sidebar, header) ─── */
export const F_LIGHT = {
  headerBg: '#ffffff',
  headerBorder: '#e5e5e5',
  sidebarBg: '#0d0d0d',
  sidebarBorder: '#e5e5e5',
  sidebarActiveBg: '#5e6ad2',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#f5f5f5',
  textPrimary: '#0d0d0d',
  textSecondary: '#737373',
  avatarBg: '#ebf8fe',
  avatarBorder: '#ffffff',
  badgeBg: '#d4163a',
  badgeText: '#ffffff',
  contentBg: '#ffffff',
  hoverBg: '#f5f5f5',
} as const;

export const F_DARK = {
  headerBg: '#0d0d0d',
  headerBorder: '#333333',
  sidebarBg: '#0d0d0d',
  sidebarBorder: '#333333',
  sidebarActiveBg: '#5e6ad2',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#f5f5f5',
  textPrimary: '#f5f5f5',
  textSecondary: '#d4d4d4',
  avatarBg: '#1a1a1a',
  avatarBorder: '#333333',
  badgeBg: '#d4163a',
  badgeText: '#ffffff',
  contentBg: '#131313',
  hoverBg: '#1a1a1a',
} as const;

export type FTheme = { [K in keyof typeof F_LIGHT]: string };

/* ─── Page content tokens (Linear-inspired) ─── */
/* Every dashboard page uses these. No page-level color objects allowed. */

export const PAGE_LIGHT = {
  // Surfaces
  bg: '#f7f8f8',
  surface: '#ffffff',
  surfaceElevated: '#f3f4f5',
  // Borders
  border: 'rgba(0,0,0,0.06)',
  borderStrong: 'rgba(0,0,0,0.1)',
  // Text
  text: '#0f1011',
  textSecondary: '#5c5f66',
  textTertiary: '#8a8f98',
  // Accent (Linear indigo)
  accent: '#5e6ad2',
  accentHover: '#828fff',
  accentSoft: 'rgba(94,106,210,0.08)',
  // Status
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.08)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.06)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245,158,11,0.08)',
  // Tables & lists
  rowHover: '#f9fafb',
  // AI surfaces
  aiGradient: 'linear-gradient(135deg, rgba(94,106,210,0.06) 0%, rgba(113,112,255,0.04) 100%)',
  aiBorder: 'rgba(94,106,210,0.15)',
  // Badges
  badgeBg: 'rgba(94,106,210,0.08)',
  badgeText: '#5e6ad2',
} as const;

export const PAGE_DARK = {
  // Surfaces
  bg: '#0f1011',
  surface: '#191a1b',
  surfaceElevated: '#28282c',
  // Borders
  border: 'rgba(255,255,255,0.05)',
  borderStrong: 'rgba(255,255,255,0.08)',
  // Text
  text: '#f7f8f8',
  textSecondary: '#d0d6e0',
  textTertiary: '#62666d',
  // Accent (Linear indigo)
  accent: '#7170ff',
  accentHover: '#828fff',
  accentSoft: 'rgba(113,112,255,0.12)',
  // Status
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.12)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.1)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251,191,36,0.1)',
  // Tables & lists
  rowHover: '#1f2022',
  // AI surfaces
  aiGradient: 'linear-gradient(135deg, rgba(113,112,255,0.08) 0%, rgba(94,106,210,0.04) 100%)',
  aiBorder: 'rgba(113,112,255,0.2)',
  // Badges
  badgeBg: 'rgba(113,112,255,0.12)',
  badgeText: '#7170ff',
} as const;

export type PageTheme = typeof PAGE_LIGHT;

/* ─── Hook helper — use in pages ─── */
/* Usage:
 *   const { C, isDark } = usePageTheme();
 *   <div style={{ color: C.text, background: C.surface }}>
 */
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export function usePageTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const C = isDark ? PAGE_DARK : PAGE_LIGHT;
  return { C, isDark, mounted };
}

/* ─── Currency symbol ─── */
export const CURRENCY = '₴';

/* ─── Common inline style helpers ─── */
export const pageContainer = {
  fontFamily: FONT,
  fontFeatureSettings: FONT_FEATURES,
  height: '100%' as const,
  overflowY: 'auto' as const,
  padding: '24px 28px',
  maxWidth: 860,
};

export const cardStyle = (C: PageTheme) => ({
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '18px 20px',
});

export const headingStyle = (C: PageTheme) => ({
  fontSize: 20,
  fontWeight: 510,
  letterSpacing: '-0.3px',
  margin: 0,
  color: C.text,
  fontFamily: FONT,
  fontFeatureSettings: FONT_FEATURES,
});

export const labelStyle = (C: PageTheme) => ({
  fontSize: 12,
  fontWeight: 510,
  color: C.textTertiary,
  letterSpacing: '0.01em',
});

export const bigNumberStyle = (C: PageTheme) => ({
  fontSize: 24,
  fontWeight: 510,
  letterSpacing: '-0.5px',
  color: C.text,
});
