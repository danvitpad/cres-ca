/** --- YAML
 * name: MiniAppBottomNav
 * description: Премиум floating-pill нижняя навигация. Fresha-style: белый pill с тенью,
 *              4 иконки, активная — заполнена акцентом в pill-pocket. Работает для всех
 *              Mini App ролей (клиент / мастер / команда) — конфиг табов передаётся через
 *              `tabs` prop.
 * created: 2026-04-26
 * --- */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { T, R, SHADOW, SPRING } from './design';

export interface NavTab {
  key: string;
  href: string;
  /** Outline icon shown when inactive */
  icon: LucideIcon;
  /** Same icon for active state — стиль активной отличает background */
  iconFilled?: LucideIcon;
  label: string;
}

interface Props {
  tabs: readonly NavTab[];
  /** Override accent if needed (мастер vs клиент могут отличаться). */
  accent?: string;
  /** Hide nav (e.g. на fullscreen booking flow) */
  hidden?: boolean;
}

export function MiniAppBottomNav({ tabs, accent = T.accent, hidden = false }: Props) {
  const pathname = usePathname();
  if (hidden) return null;

  return (
    <nav
      aria-label="Bottom navigation"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 50,
        background: T.surface,
        borderRadius: R.pill,
        boxShadow: SHADOW.navBar,
        border: `1px solid ${T.borderSubtle}`,
        padding: '8px 12px',
      }}
    >
      <ul
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = active && tab.iconFilled ? tab.iconFilled : tab.icon;
          return (
            <li key={tab.key} style={{ flex: 1 }}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 48,
                  borderRadius: R.pill,
                  textDecoration: 'none',
                  color: active ? accent : T.textTertiary,
                  transition: 'color 200ms ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    transition={SPRING.snappy}
                    style={{
                      position: 'absolute',
                      inset: 4,
                      borderRadius: R.pill,
                      background: `${accent}1a`,
                    }}
                  />
                )}
                <Icon
                  size={24}
                  strokeWidth={active ? 2.4 : 2}
                  fill={active ? accent : 'none'}
                  style={{ position: 'relative', zIndex: 1 }}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
