/** --- YAML
 * name: ProfileDropdown
 * description: Unified profile/user dropdown — trigger slot + header (avatar with brand gradient ring, name, optional handle), menu items, optional destructive bottom action. Uses shared DropdownMenu primitives so style + animation match project-wide unified dropdown principle.
 * created: 2026-04-18
 * updated: 2026-04-18
 * source: .workspace/components/Profile Dropdown.txt
 * --- */

'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ProfileIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export type ProfileDropdownItem = {
  icon?: ProfileIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  value?: string;
  valueTone?: 'brand' | 'muted';
  external?: boolean;
};

export type ProfileDropdownBottomAction = {
  icon?: ProfileIcon;
  label: string;
  onClick?: () => void;
  href?: string;
};

export interface ProfileDropdownProps {
  trigger: React.ReactElement;
  name: string;
  handle?: string;
  initials?: string;
  avatarUrl?: string | null;
  items: ProfileDropdownItem[];
  bottomAction?: ProfileDropdownBottomAction;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  className?: string;
}

function ItemBody({ item }: { item: ProfileDropdownItem }) {
  const Icon = item.icon;
  return (
    <>
      <div className="flex flex-1 items-center gap-2.5">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <span className="text-sm font-medium tracking-tight whitespace-nowrap">{item.label}</span>
      </div>
      {item.value && (
        <span
          className={cn(
            'ml-auto rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight',
            item.valueTone === 'muted'
              ? 'border-border/50 bg-muted text-muted-foreground'
              : 'border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 text-[var(--color-accent)] dark:text-[#8b6cf7]',
          )}
        >
          {item.value}
        </span>
      )}
    </>
  );
}

export function ProfileDropdown({
  trigger,
  name,
  handle,
  initials,
  avatarUrl,
  items,
  bottomAction,
  align = 'end',
  side = 'bottom',
  sideOffset = 8,
  className,
}: ProfileDropdownProps) {
  const initialsText = initials || name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn('w-64', className)}
      >
        {/* Header: avatar with brand gradient ring + name (+ optional handle) */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="rounded-full bg-gradient-to-br from-[var(--color-accent)] via-[#8b6cf7] to-[#b892ff] p-[2px]">
            <Avatar className="size-10 border-2 border-popover">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="bg-popover text-[13px]">{initialsText}</AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-tight leading-tight">{name}</div>
            {handle && (
              <div className="truncate text-xs text-muted-foreground tracking-tight leading-tight">{handle}</div>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        {items.map((item, i) => {
          if (item.href) {
            return (
              <DropdownMenuItem
                key={`${item.label}-${i}`}
                render={
                  <Link
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                  />
                }
              >
                <ItemBody item={item} />
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem key={`${item.label}-${i}`} onClick={item.onClick}>
              <ItemBody item={item} />
            </DropdownMenuItem>
          );
        })}

        {bottomAction && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="border border-transparent bg-destructive/10 hover:border-destructive/30 hover:bg-destructive/20 focus:border-destructive/30 focus:bg-destructive/20"
              onClick={bottomAction.onClick}
              render={bottomAction.href ? <Link href={bottomAction.href} /> : undefined}
            >
              {bottomAction.icon && <bottomAction.icon className="size-4" />}
              <span className="text-sm font-medium tracking-tight">{bottomAction.label}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
