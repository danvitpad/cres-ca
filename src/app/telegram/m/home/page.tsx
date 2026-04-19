/** --- YAML
 * name: MasterMiniAppHome
 * description: Minimal master Mini App home — greeting + date, AI brief, compact weekly finance link. KPI grid and next-appointment hero removed per miniapp redesign (2026-04-19).
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendUp, CaretRight, Robot } from '@phosphor-icons/react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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

export default function MasterMiniAppHome() {
  const { user, ready } = useTelegram();
  const { userId } = useAuthStore();
  const router = useRouter();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [weekCompleted, setWeekCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    try {
      const seen = localStorage.getItem('cres:voice-intro-seen');
      if (!seen) router.replace('/telegram/m/voice-intro');
    } catch { /* ignore */ }
  }, [ready, router]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }

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
      setLoading(false);

      fetch('/api/telegram/m/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, period: 'week' }),
      })
        .then((r) => r.json())
        .then((j) => {
          type StatRow = { status: string; price: number | null };
          const rows = (j.appointments ?? []) as StatRow[];
          const done = rows.filter((r) => r.status === 'completed');
          setWeekRevenue(done.reduce((acc, r) => acc + Number(r.price ?? 0), 0));
          setWeekCompleted(done.length);
        })
        .catch(() => { /* ignore */ });

      fetch('/api/telegram/m/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
        .then((r) => r.json())
        .then((j) => setBrief(j.brief ?? null))
        .catch(() => setBrief(null))
        .finally(() => setBriefLoading(false));
    })();
  }, [userId]);

  if (!ready || loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/5" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="h-16 w-full animate-pulse rounded-2xl bg-white/5" />
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
      <div>
        <h1 className="text-2xl font-bold">Привет, {profileName ?? user?.first_name ?? 'мастер'} 💼</h1>
        <p className="mt-0.5 text-[12px] text-white/50">
          {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {briefLoading ? (
        <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : brief ? (
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.07] to-fuchsia-500/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
              <Robot size={18} weight="fill" className="text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Бриф от AI</p>
              <p className="mt-1.5 text-[13px] leading-snug text-white/85">{brief}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Link
        href="/telegram/m/stats"
        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <TrendUp size={18} weight="bold" className="text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Финансы · неделя</p>
            <p className="mt-1 text-base font-bold tabular-nums">
              {weekRevenue.toFixed(0)} ₴
              <span className="ml-2 text-[11px] font-normal text-white/50">{weekCompleted} записей</span>
            </p>
          </div>
        </div>
        <CaretRight size={16} className="text-white/40" />
      </Link>
    </motion.div>
  );
}
