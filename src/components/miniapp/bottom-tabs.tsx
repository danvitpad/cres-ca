/** --- YAML
 * name: BottomTabs
 * description: Reusable mini-app bottom navigation. Accepts tabs config + pathname matcher + optional badge. Renders fixed-bottom bar with safe-area padding.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptic } from './use-haptic';

export type BottomTab = {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
};

export function BottomTabs({ tabs }: { tabs: readonly BottomTab[] }) {
  const pathname = usePathname();
  const { selection } = useHaptic();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1f2023]/95 backdrop-blur-xl"
      style={{
        paddingBottom: 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))',
      }}
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 pt-2 pb-2">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const hasBadge = typeof tab.badge === 'number' && tab.badge > 0;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                onClick={selection}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-white' : 'text-white/40 hover:text-white/70',
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn('size-[22px] transition-transform', active && 'scale-110')}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {hasBadge && (
                    <span className="absolute -right-1.5 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {tab.badge! > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute -top-[9px] left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-white" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
