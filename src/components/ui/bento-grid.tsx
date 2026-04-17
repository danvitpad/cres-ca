/** --- YAML
 * name: BentoGrid
 * description: Asymmetric card grid with hover effects — from 21st.dev. Each tile can colSpan 1 or 2 for visual variety. Used for Help & Support, dashboards, feature showcases.
 * created: 2026-04-17
 * updated: 2026-04-17
 * source: references/ui-snippets-21st/Бенто-сетка.txt
 * --- */

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BentoItem {
  title: string;
  description?: string;
  icon: ReactNode;
  meta?: string;
  status?: string;
  tags?: string[];
  cta?: string;
  colSpan?: 1 | 2;
  hasPersistentHover?: boolean;
  onClick?: () => void;
  href?: string;
}

interface BentoGridProps {
  items: BentoItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function BentoGrid({ items, columns = 3, className }: BentoGridProps) {
  const colsClass = columns === 2
    ? 'md:grid-cols-2'
    : columns === 4
      ? 'md:grid-cols-2 lg:grid-cols-4'
      : 'md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={cn('grid grid-cols-1 gap-3', colsClass, className)}>
      {items.map((item, index) => {
        const Wrapper = item.href ? 'a' : (item.onClick ? 'button' : 'div') as 'div';
        const wrapperProps: Record<string, unknown> = {};
        if (item.href) wrapperProps.href = item.href;
        if (item.onClick) wrapperProps.onClick = item.onClick;

        return (
          <Wrapper
            key={index}
            {...wrapperProps}
            className={cn(
              'group relative p-5 rounded-xl overflow-hidden text-left transition-all duration-300',
              'border border-border bg-card',
              'hover:shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:hover:shadow-[0_2px_12px_rgba(255,255,255,0.03)]',
              'hover:-translate-y-0.5 will-change-transform',
              item.colSpan === 2 ? 'md:col-span-2' : 'col-span-1',
              {
                'shadow-[0_2px_12px_rgba(0,0,0,0.03)] -translate-y-0.5': item.hasPersistentHover,
                'dark:shadow-[0_2px_12px_rgba(255,255,255,0.03)]': item.hasPersistentHover,
              },
              item.href || item.onClick ? 'cursor-pointer' : '',
            )}
          >
            {/* Dot pattern on hover */}
            <div
              className={cn(
                'absolute inset-0 transition-opacity duration-300',
                item.hasPersistentHover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px]" />
            </div>

            <div className="relative flex flex-col gap-3">
              {/* Top: icon + optional status */}
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary group-hover:bg-primary/15 transition-all">
                  {item.icon}
                </div>
                {item.status && (
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-1 rounded-md uppercase tracking-wide',
                    'bg-muted text-muted-foreground',
                  )}>
                    {item.status}
                  </span>
                )}
              </div>

              {/* Title + meta */}
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground tracking-tight text-[15px]">
                  {item.title}
                  {item.meta && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">{item.meta}</span>
                  )}
                </h3>
                {item.description && (
                  <p className="text-[13px] text-muted-foreground leading-snug">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Tags + CTA */}
              {(item.tags?.length || item.cta) && (
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {item.tags?.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-muted text-[11px]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  {item.cta && (
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.cta}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Gradient border on hover */}
            <div
              className={cn(
                'absolute inset-0 -z-10 rounded-xl p-px bg-gradient-to-br from-transparent via-border to-transparent transition-opacity duration-300',
                item.hasPersistentHover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            />
          </Wrapper>
        );
      })}
    </div>
  );
}
