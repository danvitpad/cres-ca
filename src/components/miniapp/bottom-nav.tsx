/** --- YAML
 * name: MiniAppBottomNav
 * description: Премиум floating-pill нижняя навигация с frosted-glass фоном,
 *              подписями под иконками и iOS-style активным состоянием.
 *              Работает для всех Mini App ролей через `tabs` prop.
 * created: 2026-04-26
 * updated: 2026-05-09 (glass + labels + premium active state)
 * --- */

'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from './nav-link';
import { T, R, SHADOW, SPRING } from './design';

export interface NavTab {
  key: string;
  href: string;
  icon: LucideIcon;
  iconFilled?: LucideIcon;
  label: string;
}

interface Props {
  tabs: readonly NavTab[];
  accent?: string;
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
        background: 'var(--m-nav-bg, rgba(255,255,255,0.88))',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: R.pill,
        boxShadow: SHADOW.navBar,
        border: `0.5px solid ${T.borderSubtle}`,
        padding: '6px 8px',
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
              <NavLink
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '6px 4px',
                  borderRadius: R.xl,
                  textDecoration: 'none',
                  color: active ? accent : T.textTertiary,
                  transition: 'color 180ms ease',
                  WebkitTapHighlightColor: 'transparent',
                  minHeight: 52,
                }}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    transition={SPRING.snappy}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: R.xl,
                      background: `${accent}18`,
                    }}
                  />
                )}
                <Icon
                  size={24}
                  strokeWidth={active ? 2.5 : 2}
                  fill="none"
                  style={{ position: 'relative', zIndex: 1 }}
                />
                {/* Подписи под иконками убраны (2026-05-10): по решению Данила
                    bottom-nav теперь только иконки + активный pill, без текста.
                    Каждая иконка должна быть однозначной — это правило для
                    выбора иконок в новых табах. Лейбл остаётся в aria-label
                    выше для скринридеров. */}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
