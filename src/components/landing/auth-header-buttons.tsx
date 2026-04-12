/** --- YAML
 * name: AuthHeaderButtons
 * description: Header buttons — dropdown menu when logged in (Fresha-style), or sign in/up when not
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  CalendarDays,
  Users,
  Briefcase,
  DollarSign,
  Settings,
  LogOut,
  Heart,
  Home,
} from 'lucide-react';

type UserInfo = { name: string; email: string; role: string };

export function AuthHeaderButtons() {
  const ta = useTranslations('auth');
  const td = useTranslations('dashboard');
  const tc = useTranslations('clientNav');
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setUser({
            name: profile.full_name || session.user.email || '',
            email: session.user.email || '',
            role: profile.role,
          });
        }
      }
      setLoading(false);
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
      } else {
        check();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  }

  if (loading) {
    return <div className="w-20 h-8" />;
  }

  if (!user) {
    return (
      <>
        <Link
          href="/user-flow"
          className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800"
        >
          {ta('signIn')}
        </Link>
        <Link
          href="/user-flow"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90"
        >
          {ta('signUp')}
        </Link>
      </>
    );
  }

  const isClient = user.role === 'client';

  const clientItems = [
    { label: tc('feed'), href: '/feed', icon: Home },
    { label: tc('calendar'), href: '/my-calendar', icon: CalendarDays },
    { label: tc('masters'), href: '/masters', icon: Heart },
    { label: tc('profile'), href: '/profile', icon: User },
  ];

  const masterItems = [
    { label: td('calendar'), href: '/calendar', icon: CalendarDays },
    { label: td('clients'), href: '/clients', icon: Users },
    { label: td('services'), href: '/services', icon: Briefcase },
    { label: td('finance'), href: '/finance', icon: DollarSign },
    { label: td('settings'), href: '/settings', icon: Settings },
  ];

  const menuItems = isClient ? clientItems : masterItems;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-foreground p-1 pl-3 text-sm font-medium text-background transition-opacity hover:opacity-90 focus:outline-none">
        <span className="hidden sm:inline">{user.name.split(' ')[0]}</span>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User info */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Nav items */}
        <DropdownMenuGroup>
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.href} className="cursor-pointer" onClick={() => router.push(item.href)}>
              <item.icon className="mr-2 size-4 text-muted-foreground" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" />
          {ta('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
