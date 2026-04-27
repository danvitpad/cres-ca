/** --- YAML
 * name: MasterMiniAppNotifications
 * description: Master Mini App inbox — notifications with actionable cards (follow-back, navigate to profile). Group by day, mark read on tap, per-item dismiss (X), "Clear all".
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, Loader2, Inbox, UserPlus, UserCheck, Users, X, MailOpen, CheckCircle2, XCircle, Send } from 'lucide-react';
import { MobilePage, PageHeader, EmptyState } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

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
  salon_invite: MailOpen,
  salon_invite_accepted: CheckCircle2,
  salon_invite_declined: XCircle,
  salon_join_request: Send,
  salon_join_approved: CheckCircle2,
  salon_join_rejected: XCircle,
};

const NOTIF_ICON_BG: Record<string, { bg: string; color: string }> = {
  new_follower: { bg: '#dbeafe', color: '#1d4ed8' },
  mutual_follow: { bg: '#dcfce7', color: '#15803d' },
  salon_invite: { bg: '#ede9fe', color: '#6d28d9' },
  salon_invite_accepted: { bg: '#dcfce7', color: '#15803d' },
  salon_invite_declined: { bg: '#fee2e2', color: '#b91c1c' },
  salon_join_request: { bg: '#fef3c7', color: '#b45309' },
  salon_join_approved: { bg: '#dcfce7', color: '#15803d' },
  salon_join_rejected: { bg: '#fee2e2', color: '#b91c1c' },
};

export default function MasterMiniAppNotifications() {
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
    const res = await fetch('/api/telegram/m/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setItems((json.notifications ?? []) as Notif[]);
    // Note: follow-states for new_follower notifications still go through
    // /api/follow which has its own auth; we just fall back to defaults here.
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    // Optimistic UI; backend mark-all happens on next "mark all read" or page reload.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    haptic('selection');
  }

  async function markAllRead() {
    if (items.filter((n) => !n.read_at).length === 0) return;
    const initData = getInitData();
    if (!initData) return;
    await fetch('/api/telegram/m/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, mark_read: true }),
    });
    haptic('success');
    load();
  }

  async function dismissOne(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    haptic('selection');
    const initData = getInitData();
    if (!initData) return;
    await fetch('/api/telegram/m/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, dismiss_id: id }),
    });
  }

  async function dismissAll() {
    if (items.length === 0) return;
    setItems([]);
    haptic('success');
    const initData = getInitData();
    if (!initData) return;
    await fetch('/api/telegram/m/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, dismiss_all: true }),
    });
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
    // Resolve public_id via existing public-facing endpoint (no auth needed)
    fetch(`/api/u/profile-public-id?id=${encodeURIComponent(targetId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.publicId) {
          router.push(`/telegram/u/${data.publicId}`);
        }
      })
      .catch(() => { /* silent */ });
  }

  if (!ready) {
    return (
      <MobilePage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
        </div>
      </MobilePage>
    );
  }

  const unreadCount = items.filter((n) => !n.read_at).length;
  const groups = groupByDay(items);

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <PageHeader
          title="Уведомления"
          subtitle={
            items.length > 0
              ? unreadCount > 0
                ? `${unreadCount} непрочитанных`
                : 'Всё прочитано'
              : undefined
          }
        />

        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: R.pill,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Прочитать всё
              </button>
            )}
            <button
              type="button"
              onClick={dismissAll}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: R.pill,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Очистить всё
            </button>
          </div>
        )}

        <div style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{ height: 72, borderRadius: R.md, background: T.bgSubtle }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: R.md,
                    background: `linear-gradient(135deg, ${T.gradientFrom}40, ${T.gradientTo}40)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Inbox size={28} color={T.accent} strokeWidth={2} />
                </div>
              }
              title="Пусто"
              desc="Новые записи и события появятся здесь"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {groups.map((g) => (
                <div key={g.key}>
                  <p
                    style={{
                      ...TYPE.micro,
                      padding: '0 4px 8px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {formatDay(g.date)}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {g.items.map((n) => {
                      const notifType = n.data?.type ?? '';
                      const Icon = NOTIF_ICONS[notifType] ?? Bell;
                      const iconStyle = NOTIF_ICON_BG[notifType] ?? {
                        bg: n.read_at ? T.bgSubtle : T.accentSoft,
                        color: n.read_at ? T.textTertiary : T.accent,
                      };
                      const followerProfileId = n.data?.follower_profile_id ?? n.data?.profile_id;
                      const isFollowNotif =
                        (notifType === 'new_follower' || notifType === 'mutual_follow') && followerProfileId;
                      const followState = followerProfileId ? followStates[followerProfileId] : undefined;

                      const salonId = (n.data as { salon_id?: string } | null)?.salon_id;
                      const navTarget =
                        notifType === 'salon_invite'
                          ? '/telegram/m/invites'
                          : (notifType === 'salon_join_approved' && salonId)
                            ? `/telegram/m/salon/${salonId}/dashboard`
                            : (notifType === 'salon_join_request' && salonId)
                              ? `/telegram/m/salon/${salonId}/team`
                              : (notifType === 'salon_invite_accepted' || notifType === 'salon_invite_declined') && salonId
                                ? `/telegram/m/salon/${salonId}/team`
                                : null;

                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              markRead(n.id);
                              if (navTarget) {
                                haptic('light');
                                router.push(navTarget);
                                return;
                              }
                              if (isFollowNotif && followerProfileId) {
                                navigateToProfile(followerProfileId);
                              }
                            }}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              width: '100%',
                              padding: '14px 14px 14px 18px',
                              borderRadius: R.md,
                              background: T.surface,
                              border: `1px solid ${T.borderSubtle}`,
                              boxShadow: SHADOW.card,
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontFamily: 'inherit',
                            }}
                          >
                            {!n.read_at && (
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 12,
                                  bottom: 12,
                                  width: 4,
                                  borderRadius: '0 4px 4px 0',
                                  background: T.accent,
                                }}
                              />
                            )}
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                flexShrink: 0,
                                borderRadius: 10,
                                background: iconStyle.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon size={16} color={iconStyle.color} strokeWidth={2.2} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {n.title}
                              </p>
                              <p
                                style={{
                                  ...TYPE.caption,
                                  marginTop: 2,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical' as const,
                                  overflow: 'hidden',
                                }}
                              >
                                {n.body}
                              </p>
                              <p style={{ ...TYPE.micro, marginTop: 4 }}>
                                {new Date(n.sent_at ?? n.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                                {' · '}
                                {n.channel}
                              </p>
                            </div>

                            {isFollowNotif && notifType === 'new_follower' && followerProfileId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFollow(followerProfileId);
                                }}
                                disabled={followState === 'loading'}
                                style={{
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '6px 12px',
                                  borderRadius: 10,
                                  border: followState === true ? `1px solid ${T.border}` : 'none',
                                  background: followState === true ? T.surface : T.text,
                                  color: followState === true ? T.textSecondary : T.bg,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: followState === 'loading' ? 'wait' : 'pointer',
                                  opacity: followState === 'loading' ? 0.6 : 1,
                                  fontFamily: 'inherit',
                                }}
                              >
                                {followState === 'loading' ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : followState === true ? (
                                  <>
                                    <UserCheck size={11} /> Взаимно
                                  </>
                                ) : (
                                  <>
                                    <UserPlus size={11} /> Подписаться
                                  </>
                                )}
                              </button>
                            )}

                            {notifType === 'mutual_follow' && (
                              <span
                                style={{
                                  flexShrink: 0,
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: T.successSoft,
                                  color: T.success,
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                Взаимно
                              </span>
                            )}

                            <span
                              role="button"
                              aria-label="Скрыть уведомление"
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissOne(n.id);
                              }}
                              style={{
                                flexShrink: 0,
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: T.textTertiary,
                                cursor: 'pointer',
                              }}
                            >
                              <X size={14} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </MobilePage>
  );
}
