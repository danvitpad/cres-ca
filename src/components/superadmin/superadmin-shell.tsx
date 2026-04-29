/** --- YAML
 * name: Superadmin shell
 * description: Dark, dense desktop layout for /superadmin/* — fixed left sidebar (8 nav items) + top bar ("Super Admin · email") + content area.
 * created: 2026-04-19
 * --- */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Star,
  Ban,
  Megaphone,
  MessageSquare,
  TrendingUp,
  Settings,
  Rocket,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ConfirmProvider } from '@/hooks/use-confirm';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/superadmin/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/superadmin/users', label: 'Пользователи', icon: Users },
  { href: '/superadmin/beta', label: 'Бета-тестировщики', icon: Rocket },
  { href: '/superadmin/subscriptions', label: 'Подписки', icon: CreditCard },
  { href: '/superadmin/whitelist', label: 'Whitelist', icon: Star },
  { href: '/superadmin/blacklist', label: 'Blacklist', icon: Ban },
  { href: '/superadmin/offers', label: 'Спецпредложения', icon: Megaphone },
  { href: '/superadmin/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/superadmin/finance', label: 'Финансы', icon: TrendingUp },
  { href: '/superadmin/settings', label: 'Настройки платформы', icon: Settings },
];

export function SuperadminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const isActive = (href: string) => {
    const stripped = pathname.replace(/^\/(ru|en|uk)(?=\/|$)/, '');
    return stripped === href || stripped.startsWith(href + '/');
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <ConfirmProvider>
    <div className="flex h-[100dvh] bg-[#111214] text-white/90">
      <aside className="flex w-60 flex-col border-r border-white/10 bg-[#1a1b1e]">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold">
            C
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight">CRES-CA</span>
            <span className="text-[10px] uppercase tracking-wider text-white/40">Admin</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'mb-0.5 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/60 hover:bg-white/[0.04] hover:text-white/90',
                ].join(' ')}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={signOut}
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white/90"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#1a1b1e] px-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-white/40">Super Admin</span>
            <span className="text-white/30">·</span>
            <span className="text-[13px] text-white/80">{email}</span>
          </div>
          <div className="text-[11px] text-white/40">Платформа CRES-CA</div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#111214]">{children}</main>
      </div>
    </div>
    </ConfirmProvider>
  );
}
