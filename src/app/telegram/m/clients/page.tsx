/** --- YAML
 * name: MasterMiniAppClientsList
 * description: Master Mini App clients — searchable list with avatars, behavior badges, total visits, last visit. Tap → client card page.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, Star, Crown, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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
  if (!iso) return 'никогда';
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  if (diff < 30) return `${Math.round(diff / 7)} нед. назад`;
  if (diff < 365) return `${Math.round(diff / 30)} мес. назад`;
  return `${Math.round(diff / 365)} г. назад`;
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
    const supabase = createClient();
    (async () => {
      const { data: m } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (!m) {
        setLoading(false);
        return;
      }
      setMasterId(m.id);
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, phone, total_visits, total_spent, last_visit_at, has_health_alert, behavior_indicators')
        .eq('master_id', m.id)
        .order('last_visit_at', { ascending: false, nullsFirst: false })
        .limit(500);
      setRows((data ?? []) as ClientRow[]);
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
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">База</p>
        <h1 className="mt-1 text-2xl font-bold">Клиенты</h1>
        <p className="mt-0.5 text-[11px] text-white/40">{rows.length} записей</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-[13px] outline-none focus:border-white/20"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : !masterId ? (
        <p className="py-10 text-center text-sm text-white/60">Профиль мастера не найден</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-8 text-center">
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
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 active:scale-[0.99] transition-transform"
                >
                  <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-[13px] font-bold">
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
                    <p className="mt-0.5 truncate text-[11px] text-white/50">
                      {c.total_visits} визит{c.total_visits === 1 ? '' : c.total_visits < 5 ? 'а' : 'ов'} · {Number(c.total_spent).toFixed(0)} ₴
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-white/40">Был {daysAgo(c.last_visit_at)}</p>
                  </div>
                  {isRisky && (
                    <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-300">
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
