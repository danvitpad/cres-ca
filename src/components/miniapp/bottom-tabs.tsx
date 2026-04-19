/** --- YAML
 * name: BottomTabs
 * description: Reusable mini-app bottom navigation. Tab caller supplies renderIcon(active) — lets each surface pick its own icon pack (Phosphor for master, Lucide for salon).
 * created: 2026-04-18
 * updated: 2026-04-19
 * --- */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from './use-haptic';

export type BottomTab = {
  key: string;
  href: string;
  label: string;
  renderIcon: (active: boolean) => ReactNode;
  badge?: number;
  match?: (pathname: string) => boolean;
};

export function BottomTabs({ tabs, showLabels = false }: { tabs: readonly BottomTab[]; showLabels?: boolean }) {
  const pathname = usePathname();
  const { selection } = useHaptic();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#111214]/95 backdrop-blur-xl"
      style={{
        paddingBottom: 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))',
      }}
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-2">
        {tabs.map((tab) => {
          const active = tab.match ? tab.match(pathname) : pathname.startsWith(tab.href);
          const hasBadge = typeof tab.badge === 'number' && tab.badge > 0;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                onClick={selection}
                aria-label={tab.label}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 transition-colors',
                  active ? 'text-white' : 'text-white/40 hover:text-white/70',
                )}
              >
                <div className="relative flex size-9 items-center justify-center">
                  {active && (
                    <span className="absolute inset-0 rounded-xl bg-white/[0.08]" />
                  )}
                  <span className="relative z-10">{tab.renderIcon(active)}</span>
                  {hasBadge && (
                    <span className="absolute -right-0.5 -top-0.5 z-20 flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {tab.badge! > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                {showLabels && <span className="text-[10px] font-medium">{tab.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
