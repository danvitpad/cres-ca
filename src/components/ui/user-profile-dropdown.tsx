/** --- YAML
 * name: UserProfileDropdown
 * description: Header profile avatar dropdown — from 21st.dev (reference snippet "Выпадающее меню профиля"). Avatar trigger → animated popup with user info, quick action icons, and menu items (with destructive variant for logout).
 * created: 2026-04-17
 * updated: 2026-04-17
 * source: references/ui-snippets-21st/Выпадающее меню профиля.txt
 * --- */

'use client';

import * as React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserProfile {
  name: string;
  handle: string;
  avatarUrl?: string | null;
}

interface ActionItem {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

interface MenuItem {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  isDestructive?: boolean;
  hasArrow?: boolean;
}

interface Props {
  user: UserProfile;
  actions?: ActionItem[];
  menuItems: MenuItem[];
  children?: React.ReactNode; // custom trigger
}

export function UserProfileDropdown({ user, actions, menuItems, children }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);

  const contentVariants = {
    hidden: { opacity: 0, y: -6, scale: 0.98 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: {
        type: 'spring' as const,
        damping: 22,
        stiffness: 320,
        staggerChildren: 0.04,
      },
    },
    exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          children
            ? (children as React.ReactElement)
            : (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer">
                <Avatar className="h-9 w-9">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            )
        }
      />

      <AnimatePresence>
        {isOpen && (
          <DropdownMenuContent
            className="w-64 p-2"
            align="end"
            sideOffset={8}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={contentVariants}
            >
              {/* User info — plain div (MenuGroupLabel requires a MenuGroup ancestor) */}
              <div className="flex items-center gap-3 p-2">
                <Avatar className="h-10 w-10">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.handle}</p>
                </div>
              </div>
              <DropdownMenuSeparator className="mx-2" />

              {/* Quick actions */}
              {actions && actions.length > 0 && (
                <>
                  <DropdownMenuGroup>
                    <div className="grid grid-cols-3 gap-1 p-1">
                      {actions.map((action) => (
                        <Button
                          key={action.label}
                          variant="ghost"
                          className="flex flex-col h-16 items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
                          onClick={action.onClick}
                        >
                          <action.icon className="h-5 w-5" />
                          <span className="text-[10px] font-medium">{action.label}</span>
                        </Button>
                      ))}
                    </div>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="mx-2 mb-1" />
                </>
              )}

              {/* Menu items */}
              <DropdownMenuGroup>
                {menuItems.map((item) => (
                  <motion.div variants={itemVariants} key={item.label}>
                    <DropdownMenuItem
                      onMouseEnter={() => setHoveredItem(item.label)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={cn(
                        'flex items-center justify-between p-2 text-sm relative cursor-pointer',
                        item.isDestructive && 'text-destructive focus:text-destructive-foreground focus:bg-destructive',
                      )}
                      onClick={item.onClick}
                    >
                      {hoveredItem === item.label && (
                        <motion.div
                          layoutId="dropdown-hover-bg"
                          className={cn(
                            'absolute inset-0 rounded-md -z-10',
                            item.isDestructive ? 'bg-destructive/10' : 'bg-muted',
                          )}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        {item.icon && <item.icon className="h-4 w-4" />}
                        <span>{item.label}</span>
                      </div>
                      {item.hasArrow && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </DropdownMenuItem>
                  </motion.div>
                ))}
              </DropdownMenuGroup>
            </motion.div>
          </DropdownMenuContent>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
}
