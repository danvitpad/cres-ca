/** --- YAML
 * name: SectionSidebar
 * description: Fresha-exact secondary sidebar for section subnavigation (Sales, Clients, Catalogue, etc.)
 * --- */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { FONT } from '@/lib/dashboard-theme';

const LIGHT = {
  sidebarBg: '#ffffff',
  sidebarBorder: '#e5e5e5',
  text: '#000000',
  activeBg: '#f5f5f5',
  activeText: '#000000',
  hoverBg: '#fafafa',
  sectionTitle: '#737373',
  divider: '#e5e5e5',
};

const DARK = {
  sidebarBg: '#000000',
  sidebarBorder: '#1a1a1a',
  text: '#f5f5f5',
  activeBg: '#0a0a0a',
  activeText: '#f5f5f5',
  hoverBg: '#0a0a0a',
  sectionTitle: '#999999',
  divider: '#1a1a1a',
};

export interface SectionNavGroup {
  title?: string;
  items: { label: string; href: string; exact?: boolean }[];
}

interface SectionSidebarProps {
  groups: SectionNavGroup[];
}

export function SectionSidebar({ groups }: SectionSidebarProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  function isActive(href: string, exact?: boolean) {
    const fullPath = `/${locale}${href}`;
    if (exact) return pathname === fullPath;
    return pathname === fullPath || pathname.startsWith(fullPath + '/');
  }

  return (
    <div style={{
      width: 220,
      minWidth: 220,
      borderRight: `0.8px solid ${C.sidebarBorder}`,
      backgroundColor: C.sidebarBg,
      padding: '20px 12px',
      overflowY: 'auto',
      flexShrink: 0,
      fontFamily: FONT,
    }}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <div style={{
              borderTop: `0.8px solid ${C.divider}`,
              margin: '12px 16px',
            }} />
          )}
          {group.title && (
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.sectionTitle,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '8px 16px 8px',
            }}>
              {group.title}
            </div>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {group.items.map(item => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: active ? 500 : 400,
                    color: active ? C.activeText : C.text,
                    backgroundColor: active ? C.activeBg : 'transparent',
                    borderRadius: 8,
                    textDecoration: 'none',
                    lineHeight: '20px',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = C.hoverBg;
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

export function SectionLayout({ groups, children }: SectionSidebarProps & { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SectionSidebar groups={groups} />
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '32px 40px' }}>
        {children}
      </div>
    </div>
  );
}
