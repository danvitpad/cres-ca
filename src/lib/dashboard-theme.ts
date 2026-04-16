/** --- YAML
 * name: Dashboard Theme
 * description: Fresha-exact theme palettes for dashboard header/sidebar — shared between layout and extracted components.
 * created: 2026-04-16
 * --- */

export const F_LIGHT = {
  headerBg: '#ffffff',
  headerBorder: '#e5e5e5',
  sidebarBg: '#0d0d0d',
  sidebarBorder: '#e5e5e5',
  sidebarActiveBg: '#6950f3',
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
  sidebarActiveBg: '#6950f3',
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
