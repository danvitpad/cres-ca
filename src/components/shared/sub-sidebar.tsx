/** --- YAML
 * name: SubSidebar
 * description: Fresha-style secondary sidebar — section heading with collapse, active item with purple left border
 * --- */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

type SubSidebarItem = {
  label: string;
  href: string;
  badge?: string;
};

type SubSidebarGroup = {
  items: SubSidebarItem[];
  separator?: boolean;
};

type SubSidebarProps = {
  title: string;
  groups: SubSidebarGroup[];
  collapsible?: boolean;
};

const LIGHT = {
  bg: '#ffffff',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#737373',
  activeBg: '#f0f0ff',
  activeText: '#000000',
  activeBorder: 'var(--color-accent)',
  hoverBg: '#f5f5f5',
  badgeBg: '#0075a8',
  badgeText: '#ffffff',
  headingText: '#000000',
};

const DARK = {
  bg: '#000000',
  border: '#1a1a1a',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  activeBg: '#2d2a4e',
  activeText: '#e5e5e5',
  activeBorder: '#2dd4bf',
  hoverBg: '#0a0a0a',
  badgeBg: '#2dd4bf',
  badgeText: '#ffffff',
  headingText: '#e5e5e5',
};

export function SubSidebar({ title, groups, collapsible = true }: SubSidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setMounted(true), []);

  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          flexShrink: 0,
          borderRight: `0.8px solid ${C.border}`,
          backgroundColor: C.bg,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: C.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(180deg)',
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: `0.8px solid ${C.border}`,
        backgroundColor: C.bg,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Section heading with collapse button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 16px 12px',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: C.headingText }}>
          {title}
        </span>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: C.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <nav style={{ padding: '0 8px 16px' }}>
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.separator && gi > 0 && (
              <div style={{
                height: 1,
                backgroundColor: C.border,
                margin: '8px 8px',
              }} />
            )}
            {group.items.map((item) => {
              const isActive = pathname.endsWith(item.href) || pathname.includes(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    borderLeft: isActive ? `3px solid ${C.activeBorder}` : '3px solid transparent',
                    backgroundColor: isActive ? C.activeBg : 'transparent',
                    color: isActive ? C.activeText : C.text,
                    fontSize: 14,
                    fontWeight: isActive ? 500 : 400,
                    textDecoration: 'none',
                    transition: 'background 100ms',
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = C.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      backgroundColor: C.badgeBg,
                      color: C.badgeText,
                      borderRadius: 999,
                      padding: '2px 6px',
                      minWidth: 8,
                      height: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
