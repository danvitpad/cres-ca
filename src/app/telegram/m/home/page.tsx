/** --- YAML
 * name: MasterMiniAppHome
 * description: Master Mini App home — today KPIs (revenue, count, next slot), next appointment hero, quick actions. Dark theme, framer-motion.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Users, Clock, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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
  const [next, setNext] = useState<NextApt | null>(null);
  const [stats, setStats] = useState<TodayStats>({ count: 0, revenue: 0, done: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      const { data: m } = await supabase
        .from('masters')
        .select('id, is_busy')
        .eq('profile_id', userId)
        .maybeSingle();
      if (!m) {
        setLoading(false);
        return;
      }
      setMasterId(m.id);
      setIsBusy(Boolean((m as { is_busy: boolean | null }).is_busy));

      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const { data: todayRows } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, price, status, client:clients(profile:profiles(full_name)), service:services(name)')
        .eq('master_id', m.id)
        .gte('starts_at', dayStart)
        .lt('starts_at', dayEnd)
        .order('starts_at', { ascending: true });

      type Row = {
        id: string;
        starts_at: string;
        ends_at: string;
        price: number | null;
        status: string;
        client: { profile: { full_name: string } | { full_name: string }[] | null } | null;
        service: { name: string } | { name: string }[] | null;
      };
      const rows = (todayRows ?? []) as unknown as Row[];
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
        <h1 className="mt-1 text-2xl font-bold">Привет, {user?.first_name ?? 'мастер'} 💼</h1>
        <p className="mt-0.5 text-[12px] text-white/50">
          {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Busy toggle */}
      <button
        onClick={async () => {
          haptic('medium');
          const supabase = createClient();
          const newVal = !isBusy;
          setIsBusy(newVal);
          await supabase.from('masters').update({ is_busy: newVal }).eq('id', masterId!);
        }}
        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
          isBusy
            ? 'border-rose-500/40 bg-rose-500/15'
            : 'border-emerald-500/30 bg-emerald-500/10'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
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

      {/* Next appointment hero */}
      {next ? (
        <Link
          href={`/telegram/m/calendar?id=${next.id}`}
          onClick={() => haptic('light')}
          className="block overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-rose-600/30 p-6 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Следующая запись</p>
              <p className="mt-2 text-xl font-bold truncate">{next.service_name}</p>
              <p className="mt-1 truncate text-sm text-white/70">{next.client_name}</p>
              <div className="mt-4 flex items-center gap-3 text-[12px] text-white/80">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {new Date(next.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(next.ends_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <span className="text-white/40">·</span>
                <span className="font-semibold">{next.price.toFixed(0)} ₴</span>
              </div>
            </div>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <Calendar className="size-6" />
            </div>
          </div>
        </Link>
      ) : stats.count === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/10">
            <Sparkles className="size-6 text-white/60" />
          </div>
          <p className="mt-4 text-base font-semibold">Сегодня записей нет</p>
          <p className="mt-1 text-xs text-white/50">Отдохни или открой слот для новых клиентов</p>
        </div>
      ) : (
        <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20">
            <AlertCircle className="size-6 text-emerald-300" />
          </div>
          <p className="mt-4 text-base font-semibold">День закрыт 🎉</p>
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
        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 active:scale-[0.99] transition-transform"
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
  const accents: Record<string, string> = {
    violet: 'from-violet-500/25 to-violet-500/5 text-violet-200',
    emerald: 'from-emerald-500/25 to-emerald-500/5 text-emerald-200',
    amber: 'from-amber-500/25 to-amber-500/5 text-amber-200',
  };
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accents[accent]} p-3`}>
      <Icon className="size-4 opacity-80" />
      <p className="mt-2 text-base font-bold text-white">{value}</p>
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
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 active:scale-[0.97] transition-transform"
    >
      <div className="flex size-9 items-center justify-center rounded-xl bg-white/10">
        <Icon className="size-[18px]" />
      </div>
      <span className="text-[13px] font-semibold">{label}</span>
    </Link>
  );
}
