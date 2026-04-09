/** --- YAML
 * name: Client Layout
 * description: Instagram-style client layout with 5-tab bottom nav, glassmorphism header, scroll-aware tab bar
 * --- */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, CalendarDays, Plus, Users, User, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'feed', icon: Home, href: '/feed', center: false },
  { key: 'calendar', icon: CalendarDays, href: '/my-calendar', center: false },
  { key: 'book', icon: Plus, href: '/book', center: true },
  { key: 'masters', icon: Users, href: '/masters', center: false },
  { key: 'profile', icon: User, href: '/profile', center: false },
] as const;

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('clientNav');
  const tAuth = useTranslations('auth');

  const [tabBarVisible, setTabBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentY = el.scrollTop;
    if (currentY > lastScrollY.current && currentY > 60) {
      setTabBarVisible(false);
    } else {
      setTabBarVisible(true);
    }
    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b px-4 glass">
        <Link href="/" className="text-lg font-bold tracking-tight">
          CRES-CA
        </Link>
        <button
          onClick={handleSignOut}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label={tAuth('signOut')}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Content */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom tab bar */}
      <motion.nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t glass pb-[env(safe-area-inset-bottom)]"
        initial={false}
        animate={{ y: tabBarVisible ? 0 : 80 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      >
        {tabs.map(({ key, icon: Icon, href, center }) => {
          const isActive = pathname.includes(href);

          if (center) {
            return (
              <Link
                key={key}
                href={href}
                className="relative -mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ds-accent)] text-white shadow-[var(--shadow-elevated)] transition-transform active:scale-90"
              >
                <Icon className="h-6 w-6" strokeWidth={2.5} />
              </Link>
            );
          }

          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] transition-colors',
                isActive ? 'text-[var(--ds-accent)]' : 'text-muted-foreground',
              )}
            >
              <Icon
                className={cn('h-5 w-5 transition-all', isActive && 'scale-110')}
                fill={isActive ? 'currentColor' : 'none'}
                strokeWidth={isActive ? 1.5 : 2}
              />
              <span className="font-medium">{t(key)}</span>
              {isActive && (
                <motion.div
                  layoutId="client-tab-dot"
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[var(--ds-accent)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}
