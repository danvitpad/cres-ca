/** --- YAML
 * name: MasterMiniAppHome
 * description: Master Mini App home — today KPIs, next appointment hero, quick actions. Flat cards, accent-strip hero (Phase 7.1 redesign).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Users, Clock, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';
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
  } catch { /* ignore */ }
  return null;
}
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface NextApt {
  id: string;
  starts_at: string;
  ends_at: string;
  price: number;
  client_name: string;
  service_name: string;
}

interface TodayStats {
  count: number;
  revenue: number;
  done: number;
  upcoming: number;
}

export default function MasterMiniAppHome() {
  const { user, ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [next, setNext] = useState<NextApt | null>(null);
  const [stats, setStats] = useState<TodayStats>({ count: 0, revenue: 0, done: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }

      // Step 1 — basic context (master/profile/today aggregates)
      const ctxRes = await fetch('/api/telegram/m/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!ctxRes.ok) { setLoading(false); return; }
      const ctx = await ctxRes.json();
      if (!ctx.master) { setLoading(false); return; }
      setMasterId(ctx.master.id);
      setProfileName(ctx.profile?.full_name?.split(' ')[0] || null);
      setIsBusy(Boolean(ctx.master.is_busy));

      // Step 2 — full today appointments (for "next" card)
      const today = new Date();
      const calRes = await fetch('/api/telegram/m/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, day_iso: today.toISOString() }),
      });
      if (calRes.ok) {
        const calJson = await calRes.json();
        type Row = {
          id: string;
          starts_at: string;
          ends_at: string;
          price: number | null;
          status: string;
          client: { profile: { full_name: string } | { full_name: string }[] | null } | null;
          service: { name: string } | { name: string }[] | null;
        };
        const rows = (calJson.appointments ?? []) as Row[];
        const now = new Date();
        const active = rows.filter((r) => r.status !== 'cancelled_by_client' && r.status !== 'cancelled_by_master' && r.status !== 'no_show');
        const done = active.filter((r) => r.status === 'completed');
        const upcoming = active.filter((r) => r.status !== 'completed' && new Date(r.starts_at) >= now);
        const revenue = done.reduce((acc, r) => acc + Number(r.price ?? 0), 0);
        setStats({ count: active.length, revenue, done: done.length, upcoming: upcoming.length });

        const firstUpcoming = upcoming[0];
        if (firstUpcoming) {
          const cp = Array.isArray(firstUpcoming.client?.profile) ? firstUpcoming.client?.profile[0] : firstUpcoming.client?.profile;
          const svc = Array.isArray(firstUpcoming.service) ? firstUpcoming.service[0] : firstUpcoming.service;
          setNext({
            id: firstUpcoming.id,
            starts_at: firstUpcoming.starts_at,
            ends_at: firstUpcoming.ends_at,
            price: Number(firstUpcoming.price ?? 0),
            client_name: cp?.full_name ?? 'Клиент',
            service_name: svc?.name ?? '—',
          });
        }
      }
      setLoading(false);
    })();
  }, [userId]);

  if (!ready || loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/5" />
        <div className="h-36 w-full animate-pulse rounded-3xl bg-white/5" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!masterId) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-sm text-white/60">Профиль мастера не найден</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 px-5 pt-6"
    >
      {/* Greeting */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">CRES-CA · Мастер</p>
        <h1 className="mt-1 text-2xl font-bold">Привет, {profileName ?? user?.first_name ?? 'мастер'} 💼</h1>
        <p className="mt-0.5 text-[12px] text-white/50">
          {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Busy toggle — flat card */}
      <button
        onClick={async () => {
          haptic('medium');
          const newVal = !isBusy;
          setIsBusy(newVal);
          const initData = getInitData();
          if (initData) {
            await fetch('/api/telegram/m/home', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData, is_busy: newVal }),
            });
          }
        }}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${isBusy ? 'text-rose-300' : 'text-emerald-300'}`}>
              {isBusy ? 'Сейчас занят' : 'Свободен'}
            </p>
            <p className="mt-1 text-base font-bold">
              {isBusy ? 'Онлайн-запись выключена' : 'Онлайн-запись включена'}
            </p>
          </div>
          <div
            className={`relative h-7 w-12 rounded-full transition-colors ${
              isBusy ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                isBusy ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </div>
      </button>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={Calendar} label="Записей" value={stats.count.toString()} accent="violet" />
        <KpiCard icon={TrendingUp} label="Выручка" value={`${stats.revenue.toFixed(0)}₴`} accent="emerald" />
        <KpiCard icon={Clock} label="Впереди" value={stats.upcoming.toString()} accent="amber" />
      </div>

      {/* Next appointment hero — flat card with accent strip */}
      {next ? (
        <Link
          href={`/telegram/m/calendar?id=${next.id}`}
          onClick={() => haptic('light')}
          className="relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 active:bg-white/[0.06] transition-colors"
        >
          <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-violet-500" />
          <div className="flex items-start justify-between gap-3 pl-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Следующая запись</p>
              <p className="mt-2 text-lg font-bold truncate">{next.service_name}</p>
              <p className="mt-1 truncate text-sm text-white/60">{next.client_name}</p>
              <div className="mt-3 flex items-center gap-3 text-[12px] text-white/70 tabular-nums">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {new Date(next.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(next.ends_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <span className="text-white/30">·</span>
                <span className="font-semibold text-white/90">{next.price.toFixed(0)} ₴</span>
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-white/30" />
          </div>
        </Link>
      ) : stats.count === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white/[0.06]">
            <Sparkles className="size-5 text-white/60" />
          </div>
          <p className="mt-3 text-base font-semibold">Сегодня записей нет</p>
          <p className="mt-1 text-xs text-white/50">Отдохни или открой слот для новых клиентов</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/20 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-500/15">
            <AlertCircle className="size-5 text-emerald-300" />
          </div>
          <p className="mt-3 text-base font-semibold">День закрыт 🎉</p>
          <p className="mt-1 text-xs text-white/60">Все {stats.done} записей выполнены</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <QuickAction href="/telegram/m/calendar" icon={Calendar} label="Календарь" haptic={haptic} />
        <QuickAction href="/telegram/m/clients" icon={Users} label="Клиенты" haptic={haptic} />
      </div>

      {/* Today agenda link */}
      <Link
        href="/telegram/m/calendar"
        onClick={() => haptic('selection')}
        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
      >
        <div>
          <p className="text-sm font-semibold">Расписание на день</p>
          <p className="mt-0.5 text-[11px] text-white/50">
            {stats.done}/{stats.count} · готово
          </p>
        </div>
        <ChevronRight className="size-4 text-white/40" />
      </Link>
    </motion.div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'violet' | 'emerald' | 'amber';
}) {
  const iconColor: Record<string, string> = {
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <Icon className={`size-4 ${iconColor[accent]}`} />
      <p className="mt-2 text-base font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  haptic,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  haptic: (t?: 'light') => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => haptic('light')}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
    >
      <div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon className="size-[18px] text-white/80" />
      </div>
      <span className="text-[13px] font-semibold">{label}</span>
    </Link>
  );
}
