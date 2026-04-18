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
      { key: 'dashboard', href: `/telegram/m/salon/${salonId}/dashboard`, icon: Home, label: 'Салон' },
      { key: 'calendar', href: `/telegram/m/salon/${salonId}/calendar`, icon: Calendar, label: 'Календарь' },
      { key: 'team', href: `/telegram/m/salon/${salonId}/team`, icon: Users, label: 'Команда' },
      { key: 'finance', href: `/telegram/m/salon/${salonId}/finance`, icon: Wallet, label: 'Финансы' },
      { key: 'profile', href: '/telegram/m/profile', icon: User, label: 'Профиль' },
    ];
  }
  if (role === 'receptionist') {
    return [
      { key: 'calendar', href: `/telegram/m/salon/${salonId}/calendar`, icon: Calendar, label: 'Календарь' },
      { key: 'clients', href: `/telegram/m/salon/${salonId}/clients`, icon: Users, label: 'Клиенты' },
      { key: 'profile', href: '/telegram/m/profile', icon: User, label: 'Профиль' },
    ];
  }
  // master — same surface as solo
  return [
    { key: 'home', href: '/telegram/m/home', icon: Home, label: 'Сегодня' },
    { key: 'calendar', href: '/telegram/m/calendar', icon: Calendar, label: 'Календарь' },
    { key: 'clients', href: '/telegram/m/clients', icon: Users, label: 'Клиенты' },
    { key: 'profile', href: '/telegram/m/profile', icon: User, label: 'Профиль' },
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
      <div className="flex items-center gap-2 text-white/80 text-sm font-medium truncate">
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
        className="flex items-center gap-1.5 text-white/90 text-sm font-medium rounded-lg px-2 py-1 hover:bg-white/10"
      >
        <Building2 className="size-4" />
        <span className="truncate max-w-[160px]">{salonName}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 rounded-xl bg-[#2a2b2e] border border-white/10 shadow-xl z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push('/telegram/m/home');
            }}
            className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 flex items-center gap-2"
          >
            <User className="size-4" />
            Личный кабинет
          </button>
          <div className="h-px bg-white/10" />
          <div className="px-3 py-2.5 text-sm text-white flex items-center gap-2 bg-white/5">
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
      <div className="flex h-dvh items-center justify-center bg-[#1f2023] text-white">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[#1f2023] text-white p-6 text-center">
        <div className="text-sm text-white/60">
          {error === '403' ? 'Нет доступа к этому салону' : 'Не удалось открыть салон'}
        </div>
        <button
          type="button"
          onClick={() => router.push('/telegram/m/home')}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm"
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
    <div className="flex h-dvh flex-col bg-[#1f2023] text-white">
      <header
        className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#1f2023]/95 backdrop-blur-xl"
        style={{ paddingTop: 'calc(8px + var(--tg-safe-top, 0px))' }}
      >
        <ContextSwitcher salonName={data.salon.name} isSoloMaster={data.is_solo_master} />
        <div className="text-[10px] uppercase tracking-wider text-white/40">{roleLabel}</div>
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
