/** --- YAML
 * name: Client Layout
 * description: Layout for client-facing pages — bottom navigation bar (mobile-first), simple header
 * --- */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarDays, Clock, MapPin, User, Search, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'book', icon: CalendarDays, href: '/book' },
  { key: 'masters', icon: Search, href: '/masters' },
  { key: 'map', icon: MapPin, href: '/map' },
  { key: 'history', icon: Clock, href: '/history' },
  { key: 'profile', icon: User, href: '/profile' },
] as const;

const navLabels: Record<string, string> = {
  book: 'booking.bookNow',
  masters: 'map.nearbyMasters',
  map: 'map.showOnMap',
  history: 'clients.visitHistory',
  profile: 'profile.editProfile',
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          CRES-CA
        </Link>
        <button
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('auth.signOut')}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-16">{children}</main>

      {/* Bottom navigation (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background">
        {navItems.map(({ key, icon: Icon, href }) => {
          const isActive = pathname.includes(href);
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[60px]">{key}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
