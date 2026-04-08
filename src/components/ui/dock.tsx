/** --- YAML
 * name: Dock
 * description: Sleek dark dock navigation with hover-halo effect and tooltips
 * source: 21st.dev hero-dock
 * --- */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface DockProps {
  children: React.ReactNode;
  className?: string;
}

interface DockIconProps {
  icon: LucideIcon;
  label: string;
  badge?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function Dock({ children, className }: DockProps) {
  return (
    <nav role="navigation" aria-label="Main Dock">
      <div className={cn('relative flex items-center', className)}>
        <div className="flex items-center gap-3 rounded-[28px] bg-neutral-900/80 px-3 py-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-lg sm:gap-4 sm:rounded-[48px] sm:px-5 sm:py-3">
          {children}
        </div>
      </div>
      <style>{`
        .hover-halo{position:relative}
        .hover-halo::after{content:"";position:absolute;inset:-2px;border-radius:inherit;opacity:0;transition:opacity .25s,transform .25s;box-shadow:0 0 0 0 rgba(255,255,255,.18),0 12px 30px -10px rgba(0,0,0,.7)}
        .hover-halo:hover::after{opacity:1}
        .dock-tooltip{opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}
        .group:hover .dock-tooltip{opacity:1;transform:translateY(0)}
      `}</style>
    </nav>
  );
}

export function DockSeparator() {
  return (
    <span className="mx-0.5 hidden h-6 w-px bg-white/10 sm:block" aria-hidden="true" />
  );
}

export function DockIcon({ icon: Icon, label, badge, isActive, onClick }: DockIconProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'hover-halo group relative grid h-11 w-11 place-items-center rounded-xl ring-1 ring-white/10 bg-gradient-to-b from-neutral-800/60 to-neutral-900/70 backdrop-blur-xl shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.05] sm:h-[52px] sm:w-[52px]',
        isActive && 'ring-white/30 from-neutral-700/80 to-neutral-800/90',
      )}
      aria-label={label}
    >
      <Icon
        className={cn(
          'h-5 w-5 transition-transform duration-200 group-hover:scale-110',
          isActive ? 'text-white' : 'text-white/70',
        )}
        strokeWidth={2.1}
      />
      {badge && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-white text-[9px] font-semibold text-neutral-900 ring-1 ring-white/80 sm:h-5 sm:w-5 sm:text-[10px]">
          {badge}
        </span>
      )}
      {isActive && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white" />
      )}
      <span className="dock-tooltip pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] tracking-wide text-white/80 whitespace-nowrap shadow-lg ring-1 ring-white/10">
        {label}
      </span>
    </button>
  );
}
