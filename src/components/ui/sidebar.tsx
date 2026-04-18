/** --- YAML
 * name: SessionNavBar
 * description: Hover-expand sidebar (3rem→15rem). Brand dropdown at top, nav items in scroll area, theme toggle + account dropdown at bottom. Config-driven.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProfileDropdown, type ProfileDropdownItem } from '@/components/ui/profile-dropdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type IconComp = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

export type SidebarDropdownItem = {
  icon?: IconComp;
  label: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
};

export type SidebarNavItem = {
  key: string;
  icon: IconComp;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
  activeMatch?: string;
  separatorBefore?: boolean;
  active?: boolean;
};

export type SidebarBrand = {
  label: string;
  initial?: string;
  avatarUrl?: string | null;
  menuItems?: SidebarDropdownItem[];
};

export type SidebarAccount = {
  name: string;
  email?: string;
  initials: string;
  avatarUrl?: string | null;
  menuItems: SidebarDropdownItem[];
};

export type SidebarThemeToggle = {
  isDark: boolean;
  onToggle: () => void;
  lightIcon: IconComp;
  darkIcon: IconComp;
  label: string;
};

export interface SessionNavBarProps {
  brand?: SidebarBrand;
  navItems: SidebarNavItem[];
  bottomItems?: SidebarNavItem[];
  account: SidebarAccount;
  themeToggle?: SidebarThemeToggle;
  className?: string;
}

const sidebarVariants = {
  open: { width: '15rem' },
  closed: { width: '3.5rem' },
};

const contentVariants = {
  open: { display: 'block', opacity: 1 },
  closed: { display: 'block', opacity: 1 },
};

const transitionProps = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.2,
};

const iconStyle: React.CSSProperties = { width: 20, height: 20, flexShrink: 0 };

function renderDropdownItems(items: SidebarDropdownItem[]) {
  return items.map((mi, i) => {
    const MI = mi.icon;
    const inner = (
      <>
        {MI && <MI className="h-4 w-4" style={iconStyle} />}
        <span>{mi.label}</span>
      </>
    );
    if (mi.href) {
      return (
        <DropdownMenuItem
          key={i}
          className={cn('flex items-center gap-2 cursor-pointer', mi.destructive && 'text-destructive focus:text-destructive')}
          render={<Link href={mi.href} />}
        >
          {inner}
        </DropdownMenuItem>
      );
    }
    return (
      <DropdownMenuItem
        key={i}
        onClick={mi.onClick}
        className={cn('flex items-center gap-2 cursor-pointer', mi.destructive && 'text-destructive focus:text-destructive')}
      >
        {inner}
      </DropdownMenuItem>
    );
  });
}

export function SessionNavBar({
  brand,
  navItems,
  bottomItems = [],
  account,
  themeToggle,
  className,
}: SessionNavBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();

  const destructiveIndex = account.menuItems.findIndex((mi) => mi.destructive);
  const toProfileItem = (mi: SidebarDropdownItem): ProfileDropdownItem => ({
    icon: mi.icon,
    label: mi.label,
    href: mi.href,
    onClick: mi.onClick,
  });
  const regularAccountItems: ProfileDropdownItem[] =
    destructiveIndex >= 0
      ? account.menuItems.slice(0, destructiveIndex).map(toProfileItem)
      : account.menuItems.map(toProfileItem);
  const destructiveItem = destructiveIndex >= 0 ? account.menuItems[destructiveIndex] : null;
  const destructiveAccountAction = destructiveItem
    ? {
        icon: destructiveItem.icon,
        label: destructiveItem.label,
        href: destructiveItem.href,
        onClick: destructiveItem.onClick,
      }
    : undefined;

  function isActive(item: SidebarNavItem): boolean {
    if (item.active !== undefined) return item.active;
    const match = item.activeMatch ?? item.href ?? '';
    return !!match && !!pathname && pathname.includes(match);
  }

  function NavItemContent({ item }: { item: SidebarNavItem }) {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <div
        className={cn(
          'flex h-10 w-full flex-row items-center rounded-md px-2 py-2 hover:bg-muted hover:text-primary',
          active && 'bg-muted text-blue-600',
        )}
      >
        <Icon className="shrink-0" style={iconStyle} />
        <div className="ml-3 flex items-center gap-2 overflow-hidden">
          <p className="text-[15px] font-medium whitespace-nowrap">{item.label}</p>
          {item.badge != null && item.badge !== false && (
            <Badge
              variant="outline"
              className="flex h-fit w-fit items-center gap-1.5 rounded border-none bg-blue-50 px-1.5 text-blue-600 dark:bg-blue-700 dark:text-blue-300"
            >
              {item.badge}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  function NavItem({ item }: { item: SidebarNavItem }) {
    if (item.href) {
      return (
        <Link href={item.href} onClick={item.onClick} className="block">
          <NavItemContent item={item} />
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={item.onClick}
        className="block w-full text-left bg-transparent border-none p-0 cursor-pointer"
      >
        <NavItemContent item={item} />
      </button>
    );
  }

  return (
    <motion.div
      className={cn('sidebar h-full shrink-0 border-r bg-background', className)}
      initial={isCollapsed ? 'closed' : 'open'}
      animate={isCollapsed ? 'closed' : 'open'}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div
        className="relative z-40 flex text-muted-foreground h-full shrink-0 flex-col bg-background transition-all overflow-hidden"
        variants={contentVariants}
      >
        <ul className="flex h-full flex-col list-none m-0 p-0">
          <div className="flex grow flex-col items-center min-h-0">
            {brand && (
              <div className="flex h-[54px] w-full shrink-0 border-b p-2">
                <div className="mt-[1.5px] flex w-full">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      className={cn(
                        'flex w-full items-center gap-2 px-2 h-9 rounded-md text-sm font-medium transition-colors',
                        'hover:bg-accent hover:text-accent-foreground cursor-pointer bg-transparent border-none',
                        'text-muted-foreground',
                      )}
                    >
                      <Avatar className="rounded size-4">
                        {brand.avatarUrl && <AvatarImage src={brand.avatarUrl} alt={brand.label} />}
                        <AvatarFallback>{brand.initial ?? brand.label.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {!isCollapsed && (
                        <>
                          <p className="text-sm font-medium whitespace-nowrap">{brand.label}</p>
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        </>
                      )}
                    </DropdownMenuTrigger>
                    {brand.menuItems && brand.menuItems.length > 0 && (
                      <DropdownMenuContent align="start">
                        {renderDropdownItems(brand.menuItems)}
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                </div>
              </div>
            )}

            {/* Nav items */}
            <div className="flex h-full w-full flex-col min-h-0">
              <div className="flex grow flex-col gap-4 min-h-0">
                <ScrollArea className="h-16 grow p-2">
                  <div className="flex w-full flex-col gap-1">
                    {navItems.map((item) => (
                      <React.Fragment key={item.key}>
                        {item.separatorBefore && <Separator className="w-full" />}
                        <NavItem item={item} />
                      </React.Fragment>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Bottom: custom items + theme toggle + account */}
              <div className="flex flex-col p-2 shrink-0">
                {bottomItems.map((item) => (
                  <NavItem key={item.key} item={item} />
                ))}

                {themeToggle && (
                  <button
                    type="button"
                    onClick={themeToggle.onToggle}
                    aria-label={themeToggle.label}
                    className="flex h-10 w-full flex-row items-center rounded-md px-2 py-2 hover:bg-muted hover:text-primary bg-transparent border-none cursor-pointer text-left overflow-hidden"
                  >
                    {themeToggle.isDark ? (
                      <themeToggle.lightIcon className="shrink-0" style={iconStyle} />
                    ) : (
                      <themeToggle.darkIcon className="shrink-0" style={iconStyle} />
                    )}
                    <p className="ml-3 text-[15px] font-medium whitespace-nowrap">{themeToggle.label}</p>
                  </button>
                )}

                <ProfileDropdown
                  align="end"
                  side="top"
                  sideOffset={8}
                  name={account.name || 'Профиль'}
                  handle={account.email}
                  initials={account.initials}
                  avatarUrl={account.avatarUrl}
                  items={regularAccountItems}
                  bottomAction={destructiveAccountAction}
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        'w-full flex h-10 flex-row items-center gap-3 rounded-md px-2 py-2',
                        'hover:bg-muted hover:text-primary bg-transparent border-none cursor-pointer text-left overflow-hidden',
                      )}
                    >
                      <Avatar className="size-6 shrink-0">
                        {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.name} />}
                        <AvatarFallback className="text-[11px]">{account.initials}</AvatarFallback>
                      </Avatar>
                      <p className="text-[15px] font-medium truncate whitespace-nowrap">{account.name || 'Профиль'}</p>
                      <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  }
                />
              </div>
            </div>
          </div>
        </ul>
      </motion.div>
    </motion.div>
  );
}
