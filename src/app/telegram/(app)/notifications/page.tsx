/** --- YAML
 * name: ClientMiniAppNotifications
 * description: Client Mini App inbox — list of notifications from the notifications table, group by day, mark read on tap, mark all read action.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Loader2, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface Notif {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  read_at: string | null;
}

function groupByDay(items: Notif[]) {
  const buckets: Record<string, Notif[]> = {};
  for (const n of items) {
    const d = new Date(n.sent_at ?? n.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (buckets[key] ??= []).push(n);
  }
  return Object.entries(buckets).map(([k, list]) => {
    const first = list[0];
    const d = new Date(first.sent_at ?? first.created_at);
    return { key: k, date: d, items: list };
  });
}

function formatDay(d: Date) {
  const today = new Date();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

export default function ClientMiniAppNotifications() {
  const { haptic, ready } = useTelegram();
  const { userId } = useAuthStore();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, channel, status, sent_at, created_at, read_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    haptic('selection');
  }

  async function markAllRead() {
    if (!userId || items.filter((n) => !n.read_at).length === 0) return;
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', userId)
      .is('read_at', null);
    haptic('success');
    load();
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.read_at).length;
  const groups = groupByDay(items);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-5 pt-6 pb-10"
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Inbox</p>
          <h1 className="mt-1 text-2xl font-bold">Уведомления</h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-[11px] text-white/50">{unreadCount} непрочитанных</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold active:scale-95 transition-transform"
          >
            Прочитать всё
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/10">
            <Inbox className="size-6 text-white/60" />
          </div>
          <p className="mt-4 text-base font-semibold">Пусто</p>
          <p className="mt-1 text-xs text-white/50">Новые записи и события появятся здесь</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {formatDay(g.date)}
              </p>
              <ul className="space-y-2">
                {g.items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => markRead(n.id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left active:scale-[0.99] transition-transform ${
                        n.read_at ? 'border-white/10 bg-white/5' : 'border-violet-500/30 bg-violet-500/10'
                      }`}
                    >
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${n.read_at ? 'bg-white/10' : 'bg-violet-500/30'}`}>
                        <Bell className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-white/60">{n.body}</p>
                        <p className="mt-1 text-[10px] text-white/40">
                          {new Date(n.sent_at ?? n.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {n.channel}
                        </p>
                      </div>
                      {!n.read_at && <span className="mt-1 size-2 shrink-0 rounded-full bg-violet-400" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
