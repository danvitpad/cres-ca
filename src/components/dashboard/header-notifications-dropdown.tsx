/** --- YAML
 * name: HeaderNotificationsDropdown
 * description: Fresha-style notification dropdown — grouped by day, follow-back actions, mark read, per-item dismiss (X), "Clear all".
 * created: 2026-04-16
 * updated: 2026-04-19
 * --- */

'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Bell, UserPlus, UserCheck, Users, Loader2, X } from 'lucide-react';
import type { FTheme } from '@/lib/dashboard-theme';
import type { Notification } from '@/hooks/use-notifications';
import { FreshaBell } from '@/components/shared/fresha-icons';

interface Props {
  open: boolean;
  onClose: () => void;
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  followStates: Record<string, boolean | 'loading'>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  toggleFollow: (targetId: string) => void;
  theme: FTheme;
  isDark: boolean;
}

function groupByDay(items: Notification[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  const groups: { label: string; items: Notification[] }[] = [];
  const buckets = new Map<string, Notification[]>();

  for (const n of items) {
    const d = new Date(n.sent_at ?? n.created_at);
    const ds = d.toDateString();
    const label = ds === todayStr ? 'Сегодня' : ds === yesterdayStr ? 'Вчера' : d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(n);
  }

  for (const [label, items] of buckets) {
    groups.push({ label, items });
  }
  return groups;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'сейчас';
  if (mins < 60) return `${mins} мин`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч`;
  const days = Math.floor(hrs / 24);
  return `${days} дн`;
}

const NOTIF_ICON: Record<string, typeof Bell> = {
  new_follower: UserPlus,
  mutual_follow: Users,
};

export function HeaderNotificationsDropdown({
  open, onClose, items, unreadCount, loading, followStates, markRead, markAllRead, dismiss, dismissAll, toggleFollow, theme: F, isDark,
}: Props) {
  const t = useTranslations('dashboard');

  if (!open) return null;

  const groups = groupByDay(items);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 899 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'absolute',
          top: 52,
          right: 0,
          width: 400,
          maxHeight: 520,
          backgroundColor: F.contentBg,
          borderRadius: 12,
          border: `0.8px solid ${F.headerBorder}`,
          boxShadow: '0px 4px 24px rgba(0,0,0,0.12)',
          zIndex: 900,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: `0.8px solid ${F.headerBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: F.textPrimary }}>
            {t('header.notifications')}
            {unreadCount > 0 && (
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: F.textSecondary }}>
                {unreadCount}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 13, color: 'var(--color-accent)', backgroundColor: 'transparent',
                  border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
                }}
              >
                {t('header.markAllRead')}
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={dismissAll}
                style={{
                  fontSize: 13, color: F.textSecondary, backgroundColor: 'transparent',
                  border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
                }}
              >
                {t('header.clearAll')}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 style={{ width: 20, height: 20, color: F.textSecondary, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: F.textSecondary }}>
              <FreshaBell style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3, color: F.textSecondary }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: F.textPrimary, marginBottom: 4 }}>
                {t('header.noNewNotifications')}
              </div>
              <div style={{ fontSize: 13 }}>
                {t('header.noNewNotificationsDesc')}
              </div>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {groups.map(g => (
                <div key={g.label}>
                  <div style={{
                    padding: '10px 16px 4px',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.04em', color: F.textSecondary,
                  }}>
                    {g.label}
                  </div>
                  {g.items.map(n => {
                    const notifType = n.data?.type ?? '';
                    const Icon = NOTIF_ICON[notifType] ?? Bell;
                    const followerProfileId = n.data?.follower_profile_id ?? n.data?.profile_id;
                    const isFollowNotif = (notifType === 'new_follower' || notifType === 'mutual_follow') && followerProfileId;
                    const followState = followerProfileId ? followStates[followerProfileId] : undefined;
                    const isUnread = !n.read_at;

                    return (
                      <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 16px', cursor: 'pointer',
                          backgroundColor: isUnread ? (isDark ? 'rgba(13,148,136,0.06)' : 'rgba(13,148,136,0.04)') : 'transparent',
                          transition: 'background-color 100ms',
                          borderLeft: isUnread ? '3px solid var(--color-accent)' : '3px solid transparent',
                        }}
                        onMouseEnter={e => { if (!isUnread) e.currentTarget.style.backgroundColor = F.hoverBg; }}
                        onMouseLeave={e => { if (!isUnread) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: notifType === 'new_follower' ? 'rgba(59,130,246,0.12)'
                            : notifType === 'mutual_follow' ? 'rgba(16,185,129,0.12)'
                            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          color: notifType === 'new_follower' ? '#3b82f6'
                            : notifType === 'mutual_follow' ? '#10b981'
                            : F.textSecondary,
                        }}>
                          <Icon style={{ width: 16, height: 16 }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: isUnread ? 600 : 500, color: F.textPrimary, lineHeight: '18px' }}>
                            {n.title}
                          </div>
                          {n.body && (
                            <div style={{
                              fontSize: 12, color: F.textSecondary, marginTop: 2,
                              lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {n.body}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: F.textSecondary, marginTop: 3, opacity: 0.7 }}>
                            {relativeTime(n.sent_at ?? n.created_at)}
                          </div>
                        </div>

                        {/* Follow-back button */}
                        {isFollowNotif && notifType === 'new_follower' && followerProfileId && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleFollow(followerProfileId); }}
                            disabled={followState === 'loading'}
                            style={{
                              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', transition: 'all 100ms', alignSelf: 'center',
                              border: followState === true ? `1px solid ${F.headerBorder}` : 'none',
                              backgroundColor: followState === true ? 'transparent' : 'var(--color-accent)',
                              color: followState === true ? F.textSecondary : '#ffffff',
                              opacity: followState === 'loading' ? 0.6 : 1,
                            }}
                          >
                            {followState === 'loading' ? (
                              <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                            ) : followState === true ? (
                              <><UserCheck style={{ width: 12, height: 12 }} /> Взаимно</>
                            ) : (
                              <><UserPlus style={{ width: 12, height: 12 }} /> Подписаться</>
                            )}
                          </button>
                        )}

                        {notifType === 'mutual_follow' && (
                          <span style={{
                            flexShrink: 0, alignSelf: 'center',
                            padding: '3px 8px', borderRadius: 999,
                            fontSize: 10, fontWeight: 600,
                            backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981',
                          }}>
                            Взаимно
                          </span>
                        )}

                        <button
                          onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                          aria-label={t('header.dismiss')}
                          style={{
                            flexShrink: 0, alignSelf: 'flex-start', marginTop: 2,
                            width: 22, height: 22, padding: 0, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: F.textSecondary, opacity: 0.6, transition: 'opacity 100ms, background-color 100ms',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = F.hoverBg; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
