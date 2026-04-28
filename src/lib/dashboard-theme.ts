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
  sidebarBg: '#141417',
  sidebarBorder: '#1f1f22',
  sidebarActiveBg: '#0d9488',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#a1a1aa',
  textPrimary: '#0a0a0a',
  textSecondary: '#64607a',
  avatarBg: '#f0ecfa',
  avatarBorder: '#ffffff',
  badgeBg: '#ef4444',
  badgeText: '#ffffff',
  contentBg: '#ffffff',
  hoverBg: '#f0ecfa',
} as const;

export const F_DARK = {
  headerBg: '#0e1020',
  headerBorder: '#1f1f22',
  sidebarBg: '#0f0f12',
  sidebarBorder: '#27272a',
  sidebarActiveBg: '#2dd4bf',
  sidebarActiveIconColor: '#ffffff',
  sidebarInactiveIconColor: '#a1a1aa',
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  avatarBg: '#1f1f22',
  avatarBorder: '#252840',
  badgeBg: '#ef4444',
  badgeText: '#ffffff',
  contentBg: '#141417',
  hoverBg: '#27272a',
} as const;

export type FTheme = { [K in keyof typeof F_LIGHT]: string };

/* ─── Page content tokens ─── */
/* Purple-accent palette: lavender light, navy dark. */

export const PAGE_LIGHT = {
  // Surfaces
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceElevated: '#f4f4f5',
  // Borders
  border: 'rgba(13,148,136,0.07)',
  borderStrong: 'rgba(13,148,136,0.13)',
  // Text
  text: '#0a0a0a',
  textSecondary: '#64607a',
  textTertiary: '#9994ad',
  // Accent (vivid purple)
  accent: '#0d9488',
  accentHover: '#0f766e',
  accentSoft: 'rgba(13,148,136,0.08)',
  // Status
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.08)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.06)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245,158,11,0.08)',
  // Tables & lists
  rowHover: '#fafafa',
  // AI surfaces
  aiGradient: 'linear-gradient(135deg, rgba(13,148,136,0.07) 0%, rgba(168,85,247,0.04) 100%)',
  aiBorder: 'rgba(13,148,136,0.15)',
  // Badges
  badgeBg: 'rgba(13,148,136,0.08)',
  badgeText: '#0d9488',
} as const;

export const PAGE_DARK = {
  // Surfaces — navy, not gray
  bg: '#141417',
  surface: '#1a1a1d',
  surfaceElevated: '#1f1f22',
  // Borders — purple-tinted
  border: 'rgba(45,212,191,0.08)',
  borderStrong: 'rgba(45,212,191,0.16)',
  // Text — slightly warm
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textTertiary: '#5c5876',
  // Accent (bright purple)
  accent: '#2dd4bf',
  accentHover: '#5eead4',
  accentSoft: 'rgba(45,212,191,0.12)',
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
  aiGradient: 'linear-gradient(135deg, rgba(45,212,191,0.1) 0%, rgba(13,148,136,0.05) 100%)',
  aiBorder: 'rgba(45,212,191,0.2)',
  // Badges
  badgeBg: 'rgba(45,212,191,0.12)',
  badgeText: '#2dd4bf',
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

