/** --- YAML
 * name: ClientMiniAppNotifications
 * description: Client Mini App inbox — notifications with actionable cards (follow-back, navigate to profile). Group by day, mark read on tap.
 * created: 2026-04-14
 * updated: 2026-04-16
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, Loader2, Inbox, UserPlus, UserCheck, Users } from 'lucide-react';
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

interface NotifData {
  type?: string;
  follower_profile_id?: string;
  profile_id?: string;
  [key: string]: unknown;
}

interface Notif {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  read_at: string | null;
  data: NotifData | null;
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

const NOTIF_ICONS: Record<string, typeof Bell> = {
  new_follower: UserPlus,
  mutual_follow: Users,
};

const NOTIF_COLORS: Record<string, string> = {
  new_follower: 'bg-blue-500/30',
  mutual_follow: 'bg-emerald-500/30',
};

export default function ClientMiniAppNotifications() {
  const router = useRouter();
  const { haptic, ready } = useTelegram();
  const { userId } = useAuthStore();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, boolean | 'loading'>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    const initData = getInitData();
    if (!initData) { setLoading(false); return; }
    const res = await fetch('/api/telegram/c/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setItems((json.notifications ?? []) as Notif[]);
    // Follow-states are left default; /api/follow handles its own auth if user acts.
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    // Optimistic UI; bulk-sync happens on "mark all".
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    haptic('selection');
    const initData = getInitData();
    if (!initData) return;
    await fetch('/api/telegram/c/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, mode: 'mark_read', ids: [id] }),
    });
  }

  async function markAllRead() {
    if (items.filter((n) => !n.read_at).length === 0) return;
    const initData = getInitData();
    if (!initData) return;
    await fetch('/api/telegram/c/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, mode: 'mark_read' }),
    });
    haptic('success');
    load();
  }

  async function toggleFollow(targetId: string) {
    setFollowStates(prev => ({ ...prev, [targetId]: 'loading' }));
    haptic('light');
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFollowStates(prev => ({ ...prev, [targetId]: data.following }));
        haptic(data.following ? 'success' : 'selection');
      }
    } catch {
      setFollowStates(prev => ({ ...prev, [targetId]: false }));
    }
  }

  function navigateToProfile(targetId: string) {
    haptic('light');
    fetch(`/api/u/profile-public-id?id=${encodeURIComponent(targetId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.publicId) router.push(`/telegram/u/${data.publicId}`);
      })
      .catch(() => { /* silent */ });
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
                {g.items.map((n) => {
                  const notifType = n.data?.type ?? '';
                  const Icon = NOTIF_ICONS[notifType] ?? Bell;
                  const iconColor = NOTIF_COLORS[notifType] ?? (n.read_at ? 'bg-white/10' : 'bg-violet-500/30');
                  const followerProfileId = n.data?.follower_profile_id ?? n.data?.profile_id;
                  const isFollowNotif = (notifType === 'new_follower' || notifType === 'mutual_follow') && followerProfileId;
                  const followState = followerProfileId ? followStates[followerProfileId] : undefined;

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          markRead(n.id);
                          if (isFollowNotif && followerProfileId) {
                            navigateToProfile(followerProfileId);
                          }
                        }}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left active:scale-[0.99] transition-transform ${
                          n.read_at ? 'border-white/10 bg-white/5' : 'border-violet-500/30 bg-violet-500/10'
                        }`}
                      >
                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
                          <Icon className="size-4" />
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

                        {/* Follow-back button for new_follower notifications */}
                        {isFollowNotif && notifType === 'new_follower' && followerProfileId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFollow(followerProfileId);
                            }}
                            disabled={followState === 'loading'}
                            className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-60 ${
                              followState === true
                                ? 'border border-white/15 bg-white/5 text-white/70'
                                : 'bg-white text-black'
                            }`}
                          >
                            {followState === 'loading' ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : followState === true ? (
                              <><UserCheck className="size-3" /> Взаимно</>
                            ) : (
                              <><UserPlus className="size-3" /> Подписаться</>
                            )}
                          </button>
                        )}

                        {/* Mutual badge */}
                        {notifType === 'mutual_follow' && (
                          <span className="shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                            Взаимно
                          </span>
                        )}

                        {!n.read_at && !isFollowNotif && <span className="mt-1 size-2 shrink-0 rounded-full bg-violet-400" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
