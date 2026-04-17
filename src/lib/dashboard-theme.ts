/** --- YAML
 * name: Dashboard Theme
 * description: Single source of truth for ALL dashboard styling — layout, pages, cards, tables, badges.
 *              Purple-accent design system inspired by FinSet/FINCHECK. Every dashboard page MUST import from here.
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
  headerBorder: '#ece8f4',
  sidebarBg: '#0b0d17',
  sidebarBorder: '#1a1d30',
  sidebarActiveBg: '#7c3aed',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#a8a3be',
  textPrimary: '#1a1530',
  textSecondary: '#64607a',
  avatarBg: '#f0ecfa',
  avatarBorder: '#ffffff',
  badgeBg: '#ef4444',
  badgeText: '#ffffff',
  contentBg: '#f4f2fa',
  hoverBg: '#f0ecfa',
} as const;

export const F_DARK = {
  headerBg: '#0e1020',
  headerBorder: '#1a1d30',
  sidebarBg: '#080a12',
  sidebarBorder: '#141730',
  sidebarActiveBg: '#8b5cf6',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#706c87',
  textPrimary: '#eae8f4',
  textSecondary: '#a8a3be',
  avatarBg: '#1a1d30',
  avatarBorder: '#252840',
  badgeBg: '#ef4444',
  badgeText: '#ffffff',
  contentBg: '#0b0d17',
  hoverBg: '#141730',
} as const;

export type FTheme = { [K in keyof typeof F_LIGHT]: string };

/* ─── Page content tokens ─── */
/* Purple-accent palette: lavender light, navy dark. */

export const PAGE_LIGHT = {
  // Surfaces
  bg: '#f4f2fa',
  surface: '#ffffff',
  surfaceElevated: '#ede9f7',
  // Borders
  border: 'rgba(124,58,237,0.07)',
  borderStrong: 'rgba(124,58,237,0.13)',
  // Text
  text: '#1a1530',
  textSecondary: '#64607a',
  textTertiary: '#9994ad',
  // Accent (vivid purple)
  accent: '#7c3aed',
  accentHover: '#6d28d9',
  accentSoft: 'rgba(124,58,237,0.08)',
  // Status
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.08)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.06)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245,158,11,0.08)',
  // Tables & lists
  rowHover: '#f8f6fd',
  // AI surfaces
  aiGradient: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(168,85,247,0.04) 100%)',
  aiBorder: 'rgba(124,58,237,0.15)',
  // Badges
  badgeBg: 'rgba(124,58,237,0.08)',
  badgeText: '#7c3aed',
} as const;

export const PAGE_DARK = {
  // Surfaces — navy, not gray
  bg: '#0b0d17',
  surface: '#111425',
  surfaceElevated: '#1a1d30',
  // Borders — purple-tinted
  border: 'rgba(139,92,246,0.08)',
  borderStrong: 'rgba(139,92,246,0.16)',
  // Text — slightly warm
  text: '#eae8f4',
  textSecondary: '#a8a3be',
  textTertiary: '#5c5876',
  // Accent (bright purple)
  accent: '#8b5cf6',
  accentHover: '#a78bfa',
  accentSoft: 'rgba(139,92,246,0.12)',
  // Status
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.12)',
  danger: '#f87171',
  dangerSoft: 'rgba(248,113,113,0.1)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251,191,36,0.1)',
  // Tables & lists
  rowHover: '#151830',
  // AI surfaces
  aiGradient: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(124,58,237,0.05) 100%)',
  aiBorder: 'rgba(139,92,246,0.2)',
  // Badges
  badgeBg: 'rgba(139,92,246,0.12)',
  badgeText: '#8b5cf6',
} as const;

export type PageTheme = { [K in keyof typeof PAGE_LIGHT]: string };

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
  // Default to dark pre-mount — matches ThemeProvider defaultTheme="dark" in root layout.
  // Prevents light-mode flash on dashboard pages.
  const isDark = !mounted ? true : resolvedTheme === 'dark';
  const C: PageTheme = isDark ? PAGE_DARK : PAGE_LIGHT;
  return { C, isDark, mounted };
}

/* ─── Currency symbol ─── */
export const CURRENCY = '₴';

/* ─── Common inline style helpers ─── */
export const pageContainer = {
  fontFamily: FONT,
  fontFeatureSettings: FONT_FEATURES,
  padding: 'clamp(16px, 3vw, 28px) clamp(16px, 3vw, 36px) 56px',
  maxWidth: 1280,
  margin: '0 auto' as const,
  width: '100%' as const,
};

export const cardStyle = (C: PageTheme) => ({
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: '20px 22px',
});

export const headingStyle = (C: PageTheme) => ({
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '-0.4px',
  margin: 0,
  color: C.text,
  fontFamily: FONT,
  fontFeatureSettings: FONT_FEATURES,
});

export const labelStyle = (C: PageTheme) => ({
  fontSize: 12,
  fontWeight: 510,
  color: C.textTertiary,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
});

export const bigNumberStyle = (C: PageTheme) => ({
  fontSize: 28,
  fontWeight: 600,
  letterSpacing: '-0.5px',
  color: C.text,
});

/* ─── KPI card gradients (FINCHECK-inspired) ─── */
export const KPI_GRADIENTS = {
  revenue: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
  expenses: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  profit: 'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
  neutral: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
} as const;
