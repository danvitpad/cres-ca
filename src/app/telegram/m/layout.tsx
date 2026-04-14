/** --- YAML
 * name: TelegramMasterMiniAppLayout
 * description: Master Mini App shell — dark theme, 4-tab bottom bar (Home, Calendar, Clients, Profile). Mirrors client shell but auth-gates by master row existence.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Calendar, Users, User, Loader2 } from 'lucide-react';
import { TelegramProvider } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'home', href: '/telegram/m/home', icon: Home, label: 'Сегодня' },
  { key: 'calendar', href: '/telegram/m/calendar', icon: Calendar, label: 'Календарь' },
  { key: 'clients', href: '/telegram/m/clients', icon: Users, label: 'Клиенты' },
  { key: 'profile', href: '/telegram/m/profile', icon: User, label: 'Профиль' },
] as const;

export default function MasterMiniAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!userId) {
      router.replace('/telegram');
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (!data) {
        router.replace('/telegram/home');
        return;
      }
      setChecking(false);
    })();
  }, [userId, router]);

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#1f2023] text-white">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <TelegramProvider>
      <div className="flex h-dvh flex-col bg-[#1f2023] text-white">
        <main
          className="flex-1 overflow-y-auto"
          style={{
            paddingTop: 'var(--tg-content-top, 0px)',
            paddingBottom: 'calc(72px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {children}
        </main>
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
              return (
                <li key={tab.key} className="flex-1">
                  <Link
                    href={tab.href}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium transition-colors',
                      active ? 'text-white' : 'text-white/40 hover:text-white/70',
                    )}
                  >
                    <Icon className={cn('size-[22px] transition-transform', active && 'scale-110')} strokeWidth={active ? 2.5 : 2} />
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
      </div>
    </TelegramProvider>
  );
}
