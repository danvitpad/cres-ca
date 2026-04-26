/** --- YAML
 * name: Mini App Salon Shell
 * description: Wraps all /telegram/m/salon/[id]/* screens. Fetches role, renders role-aware bottom tabs,
 *              and — for users who are also solo masters — a Personal/Salon context switcher.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Home, Calendar, Users, Wallet, User, Loader2, ChevronDown, Building2 } from 'lucide-react';
import { TelegramProvider, useTelegram } from '@/components/miniapp/telegram-provider';
import { BottomTabs, type BottomTab } from '@/components/miniapp/bottom-tabs';

type Role = 'admin' | 'master' | 'receptionist';

interface RoleData {
  salon: { id: string; name: string; logo_url: string | null; team_mode: 'unified' | 'marketplace' };
  role: Role;
  is_solo_master: boolean;
}

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function tabsForRole(role: Role, salonId: string): BottomTab[] {
  if (role === 'admin') {
    return [
      { key: 'dashboard', href: `/telegram/m/salon/${salonId}/dashboard`, label: 'Салон', renderIcon: (a) => <Home className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
      { key: 'calendar', href: `/telegram/m/salon/${salonId}/calendar`, label: 'Календарь', renderIcon: (a) => <Calendar className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
      { key: 'team', href: `/telegram/m/salon/${salonId}/team`, label: 'Команда', renderIcon: (a) => <Users className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
      { key: 'finance', href: `/telegram/m/salon/${salonId}/finance`, label: 'Финансы', renderIcon: (a) => <Wallet className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
      { key: 'profile', href: '/telegram/m/profile', label: 'Профиль', renderIcon: (a) => <User className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
    ];
  }
  if (role === 'receptionist') {
    return [
      { key: 'calendar', href: `/telegram/m/salon/${salonId}/calendar`, label: 'Календарь', renderIcon: (a) => <Calendar className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
      { key: 'clients', href: `/telegram/m/salon/${salonId}/clients`, label: 'Клиенты', renderIcon: (a) => <Users className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
      { key: 'profile', href: '/telegram/m/profile', label: 'Профиль', renderIcon: (a) => <User className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
    ];
  }
  // master — same surface as solo
  return [
    { key: 'home', href: '/telegram/m/home', label: 'Сегодня', renderIcon: (a) => <Home className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
    { key: 'calendar', href: '/telegram/m/calendar', label: 'Календарь', renderIcon: (a) => <Calendar className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
    { key: 'clients', href: '/telegram/m/clients', label: 'Клиенты', renderIcon: (a) => <Users className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
    { key: 'profile', href: '/telegram/m/profile', label: 'Профиль', renderIcon: (a) => <User className="size-[22px]" strokeWidth={a ? 2.5 : 2} /> },
  ];
}

function ContextSwitcher({
  salonName,
  isSoloMaster,
}: {
  salonName: string;
  isSoloMaster: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!isSoloMaster) {
    return (
      <div className="flex items-center gap-2 text-neutral-800 text-sm font-medium truncate">
        <Building2 className="size-4 shrink-0" />
        <span className="truncate">{salonName}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-neutral-900 text-sm font-medium rounded-lg px-2 py-1 hover:bg-white/10"
      >
        <Building2 className="size-4" />
        <span className="truncate max-w-[160px]">{salonName}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 rounded-xl bg-white border border-neutral-200 shadow-xl z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push('/telegram/m/home');
            }}
            className="w-full text-left px-3 py-2.5 text-sm text-neutral-800 hover:bg-white/5 flex items-center gap-2"
          >
            <User className="size-4" />
            Личный кабинет
          </button>
          <div className="h-px bg-white/10" />
          <div className="px-3 py-2.5 text-sm text-neutral-900 flex items-center gap-2 bg-white/5">
            <Building2 className="size-4" />
            <span className="truncate">{salonName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SalonShellInner({
  children,
  salonId,
}: {
  children: React.ReactNode;
  salonId: string;
}) {
  const { ready } = useTelegram();
  const router = useRouter();
  const [data, setData] = useState<RoleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/telegram/m/salon/${salonId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j: RoleData) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, salonId]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white text-neutral-900">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-white text-neutral-900 p-6 text-center">
        <div className="text-sm text-neutral-600">
          {error === '403' ? 'Нет доступа к этому салону' : 'Не удалось открыть салон'}
        </div>
        <button
          type="button"
          onClick={() => router.push('/telegram/m/home')}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          В личный кабинет
        </button>
      </div>
    );
  }

  const tabs = tabsForRole(data.role, salonId);
  const roleLabel =
    data.role === 'admin' ? 'Владелец' : data.role === 'receptionist' ? 'Ресепшн' : 'Мастер';

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <header
        className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white/95 backdrop-blur-xl"
        style={{ paddingTop: 'calc(8px + var(--tg-safe-top, 0px))' }}
      >
        <ContextSwitcher salonName={data.salon.name} isSoloMaster={data.is_solo_master} />
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">{roleLabel}</div>
      </header>
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom:
            'calc(72px + max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
        }}
      >
        {children}
      </main>
      <BottomTabs tabs={tabs} />
    </div>
  );
}

export default function SalonMiniAppLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const salonId = params.id as string;

  return (
    <TelegramProvider>
      <SalonShellInner salonId={salonId}>{children}</SalonShellInner>
    </TelegramProvider>
  );
}
