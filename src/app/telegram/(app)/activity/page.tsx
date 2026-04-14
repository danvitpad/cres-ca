/** --- YAML
 * name: MiniAppActivityPage
 * description: Mini App activity — segmented upcoming / past appointments with status chips.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, XCircle, Clock3, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  master_name: string;
  service_name: string;
}

type Tab = 'upcoming' | 'past';

export default function MiniAppActivityPage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data: clientRows } = await supabase.from('clients').select('id').eq('profile_id', userId);
      const clientIds = (clientRows ?? []).map((c: { id: string }) => c.id);
      if (clientIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, status, price, master:masters(profile:profiles(full_name)), service:services(name)')
        .in('client_id', clientIds)
        .order('starts_at', { ascending: false })
        .limit(50);
      const rows: AppointmentRow[] = (data ?? []).map((row: unknown) => {
        const a = row as {
          id: string;
          starts_at: string;
          status: string;
          price: number | null;
          master: { profile: { full_name: string } | { full_name: string }[] | null } | null;
          service: { name: string } | { name: string }[] | null;
        };
        const masterProfile = Array.isArray(a.master?.profile) ? a.master?.profile[0] : a.master?.profile;
        const svc = Array.isArray(a.service) ? a.service[0] : a.service;
        return {
          id: a.id,
          starts_at: a.starts_at,
          status: a.status,
          price: Number(a.price ?? 0),
          master_name: masterProfile?.full_name ?? '—',
          service_name: svc?.name ?? '—',
        };
      });
      setAppointments(rows);
      setLoading(false);
    })();
  }, [userId]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    for (const a of appointments) {
      const isDone = ['completed', 'cancelled', 'cancelled_by_client', 'no_show'].includes(a.status);
      if (!isDone && new Date(a.starts_at).getTime() >= now - 3600 * 1000) up.push(a);
      else pa.push(a);
    }
    up.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return { upcoming: up, past: pa };
  }, [appointments]);

  const visible = tab === 'upcoming' ? upcoming : past;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 px-5 pt-6"
    >
      <h1 className="text-2xl font-bold">Записи</h1>

      {/* Segmented control */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              haptic('selection');
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
              tab === t ? 'bg-white text-black' : 'text-white/60'
            }`}
          >
            {t === 'upcoming' ? `Предстоящие${upcoming.length ? ` · ${upcoming.length}` : ''}` : 'История'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/10">
            <Calendar className="size-5 text-white/50" />
          </div>
          <p className="mt-4 text-sm font-semibold">
            {tab === 'upcoming' ? 'Нет предстоящих записей' : 'Нет завершённых записей'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Link
                href={`/telegram/activity/${a.id}`}
                onClick={() => haptic('light')}
                className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 active:scale-[0.99] transition-transform"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.service_name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/60">{a.master_name}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-white/70">
                    <Calendar className="size-3" />
                    {new Date(a.starts_at).toLocaleString('ru', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {a.price > 0 && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="font-semibold text-white/90">{a.price.toFixed(0)} ₴</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <StatusChip status={a.status} />
                  <ChevronRight className="size-4 text-white/30" />
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    booked: { label: 'Записан', cls: 'bg-sky-500/15 text-sky-300', icon: Clock3 },
    confirmed: { label: 'Подтверждено', cls: 'bg-emerald-500/15 text-emerald-300', icon: CheckCircle2 },
    in_progress: { label: 'Идёт', cls: 'bg-violet-500/15 text-violet-300', icon: Clock3 },
    completed: { label: 'Завершено', cls: 'bg-emerald-500/15 text-emerald-300', icon: CheckCircle2 },
    cancelled: { label: 'Отменено', cls: 'bg-rose-500/15 text-rose-300', icon: XCircle },
    cancelled_by_client: { label: 'Отменено', cls: 'bg-rose-500/15 text-rose-300', icon: XCircle },
    no_show: { label: 'Не пришёл', cls: 'bg-amber-500/15 text-amber-300', icon: XCircle },
  };
  const info = map[status] ?? map.booked;
  const Icon = info.icon;
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${info.cls}`}>
      <Icon className="size-2.5" /> {info.label}
    </span>
  );
}
