/** --- YAML
 * name: MasterMiniAppClientsList
 * description: Master Mini App clients — searchable list with avatars, behavior badges. Flat cards, flat avatars (Phase 7.3).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, Star, Crown, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

function getInitData(): string | null {
  // 1) Live initData from Telegram WebApp
  if (typeof window !== 'undefined') {
    const w = window as { Telegram?: { WebApp?: { initData?: string } } };
    const live = w.Telegram?.WebApp?.initData;
    if (live) return live;
    // 2) Fallback to sessionStorage stash from /telegram entry
    try {
      const stash = sessionStorage.getItem('cres:tg');
      if (stash) {
        const parsed = JSON.parse(stash) as { initData?: string };
        if (parsed.initData) return parsed.initData;
      }
    } catch { /* ignore */ }
  }
  return null;
}

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  has_health_alert: boolean;
  behavior_indicators: string[] | null;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  if (diff < 30) return `${Math.round(diff / 7)} нед. назад`;
  if (diff < 365) return `${Math.round(diff / 30)} мес. назад`;
  return `${Math.round(diff / 365)} г. назад`;
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export default function MasterMiniAppClientsPage() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const initData = getInitData();
      if (!initData) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/telegram/m/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        setMasterId(json.masterId ?? null);
        setRows((json.clients ?? []) as ClientRow[]);
      } catch { /* network error */ }
      setLoading(false);
    })();
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 pt-6 pb-10">
      {/* Search — no page title per miniapp redesign (2026-04-19) */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-[13px] outline-none focus:border-white/20"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : !masterId ? (
        <p className="py-10 text-center text-sm text-white/60">Профиль мастера не найден</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm font-semibold">
            {rows.length === 0 ? 'Клиентов пока нет' : 'Ничего не найдено'}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {rows.length === 0 ? 'Они появятся после первых записей' : 'Попробуй другой запрос'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c, i) => {
            const isVIP = c.total_visits >= 10;
            const isExcellent = (c.behavior_indicators ?? []).includes('excellent');
            const isRisky = (c.behavior_indicators ?? []).some((b) => b === 'frequent_canceller' || b === 'rude' || b === 'often_late');
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 20) * 0.02 }}
              >
                <Link
                  href={`/telegram/m/clients/${c.id}`}
                  onClick={() => haptic('light')}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 active:bg-white/[0.06] transition-colors"
                >
                  <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[13px] font-bold text-white/90">
                    {initials(c.full_name) || '—'}
                    {c.has_health_alert && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 ring-2 ring-black">
                        <AlertTriangle className="size-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{c.full_name}</p>
                      {isVIP && <Crown className="size-3 text-amber-300" />}
                      {isExcellent && <Star className="size-3 fill-amber-300 text-amber-300" />}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-white/50 tabular-nums">
                      {c.total_visits} {plural(c.total_visits, ['визит', 'визита', 'визитов'])} · {Number(c.total_spent).toFixed(0)} ₴
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-white/40">
                      {c.last_visit_at ? `Был ${daysAgo(c.last_visit_at)}` : 'Ещё не приходил'}
                    </p>
                  </div>
                  {isRisky && (
                    <span className="shrink-0 rounded-full border border-rose-500/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-300">
                      риск
                    </span>
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
