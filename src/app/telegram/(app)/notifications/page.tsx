/** --- YAML
 * name: ClientMiniAppNotifications
 * description: Client Mini App inbox. Header + ghost mark-all + filter chips (Усі/Записи/Бонуси/Підписники/Промо), плоский список карточек с круглой цветной иконкой по категории, unread-точка слева. Дизайн перенесён из Open Design client-notifications.html.
 * created: 2026-04-14
 * updated: 2026-05-11
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bell,
  Loader2,
  Inbox,
  UserPlus,
  UserCheck,
  Users,
  CalendarDays,
  Gift,
  Tag,
  Info,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-notifications.css';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, TYPE, FONT_BASE, PAGE_PADDING_X } from '@/components/miniapp/design';

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

function getLocale(): 'uk' | 'ru' | 'en' {
  if (typeof window === 'undefined') return 'uk';
  try {
    const stored = localStorage.getItem('cres:locale');
    if (stored === 'ru' || stored === 'en' || stored === 'uk') return stored;
  } catch {}
  return 'uk';
}

const STR = {
  uk: {
    title: 'Сповіщення',
    markAll: 'Позначити всі як прочитані',
    chipAll: 'Усі',
    chipBooking: 'Записи',
    chipBonus: 'Бонуси',
    chipSubscriber: 'Підписники',
    chipPromo: 'Промо',
    empty: 'Порожньо',
    emptyDesc: 'Нові записи та події з\'являться тут',
    mutual: 'Взаємно',
    follow: 'Підписатися',
    locale: 'uk-UA',
  },
  ru: {
    title: 'Уведомления',
    markAll: 'Отметить все как прочитанные',
    chipAll: 'Все',
    chipBooking: 'Записи',
    chipBonus: 'Бонусы',
    chipSubscriber: 'Подписчики',
    chipPromo: 'Промо',
    empty: 'Пусто',
    emptyDesc: 'Новые записи и события появятся здесь',
    mutual: 'Взаимно',
    follow: 'Подписаться',
    locale: 'ru-RU',
  },
  en: {
    title: 'Notifications',
    markAll: 'Mark all as read',
    chipAll: 'All',
    chipBooking: 'Bookings',
    chipBonus: 'Bonuses',
    chipSubscriber: 'Followers',
    chipPromo: 'Promo',
    empty: 'Empty',
    emptyDesc: 'New bookings and events will appear here',
    mutual: 'Mutual',
    follow: 'Follow',
    locale: 'en-US',
  },
} as const;

type Category = 'all' | 'booking' | 'bonus' | 'subscriber' | 'promo';

const SUBSCRIBER_TYPES = new Set(['new_follower', 'mutual_follow', 'salon_added_you', 'added_to_contacts']);

function categorize(notif: Notif): Exclude<Category, 'all'> | 'other' {
  const type = notif.data?.type ?? '';
  if (type.startsWith('appointment') || type.startsWith('booking') || type.includes('reminder')) return 'booking';
  if (type.startsWith('bonus') || type.startsWith('loyalty') || type.includes('birthday')) return 'bonus';
  if (SUBSCRIBER_TYPES.has(type)) return 'subscriber';
  if (type.startsWith('promo') || type.startsWith('deal') || type.includes('discount')) return 'promo';
  return 'other';
}

interface CategoryStyle {
  Icon: typeof Bell;
  bg: string;
  color: string;
}

function categoryStyle(category: ReturnType<typeof categorize>, notifType: string): CategoryStyle {
  switch (category) {
    case 'booking': return { Icon: CalendarDays, bg: T.accentSoft, color: T.accent };
    case 'bonus':   return { Icon: Gift,         bg: T.successSoft, color: T.success };
    case 'subscriber': {
      if (notifType === 'mutual_follow') return { Icon: Users, bg: T.successSoft, color: T.success };
      if (notifType === 'salon_added_you' || notifType === 'added_to_contacts') return { Icon: UserCheck, bg: T.accentSoft, color: T.accent };
      return { Icon: UserPlus, bg: T.accentSoft, color: T.accent };
    }
    case 'promo':   return { Icon: Tag,          bg: T.warningSoft, color: T.warning };
    default:        return { Icon: Info,         bg: T.bg,          color: T.textSecondary };
  }
}

export default function ClientMiniAppNotifications() {
  const router = useRouter();
  const { haptic, ready } = useTelegram();
  const { userId } = useAuthStore();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, boolean | 'loading'>>({});
  const [filter, setFilter] = useState<Category>('all');

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
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
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

  const lang = getLocale();
  const t = STR[lang];

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(n => categorize(n) === filter);
  }, [items, filter]);

  const unreadCount = items.filter(n => !n.read_at).length;

  if (!ready) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={24} color={T.textTertiary} />
      </div>
    );
  }

  const chipBaseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    border: `1.5px solid ${T.border}`,
    background: T.surface,
    color: T.textSecondary,
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
  };

  const chipActiveStyle: React.CSSProperties = {
    ...chipBaseStyle,
    background: T.accent,
    borderColor: T.accent,
    color: T.accentText,
  };

  const chips: Array<{ id: Category; label: string }> = [
    { id: 'all', label: t.chipAll },
    { id: 'booking', label: t.chipBooking },
    { id: 'bonus', label: t.chipBonus },
    { id: 'subscriber', label: t.chipSubscriber },
    { id: 'promo', label: t.chipPromo },
  ];

  return (
    <motion.div
      className="od-client-notifications"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{ ...FONT_BASE, paddingTop: 12 }}
    >
      {/* Header — title + bell + ghost mark-all */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `4px ${PAGE_PADDING_X}px 8px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ ...TYPE.h2, color: T.text, margin: 0 }}>{t.title}</h1>
          <Bell size={18} color={T.accent} strokeWidth={2} />
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 9999,
              border: `1.5px solid ${T.border}`,
              background: 'transparent',
              color: T.textSecondary,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {t.markAll}
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: `4px ${PAGE_PADDING_X}px 12px`,
          scrollbarWidth: 'none',
        }}
        className="no-scrollbar"
      >
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { haptic('selection'); setFilter(c.id); }}
            style={filter === c.id ? chipActiveStyle : chipBaseStyle}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: `0 ${PAGE_PADDING_X}px`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 72,
                borderRadius: 16,
                background: T.surface,
                border: `1px solid ${T.border}`,
                opacity: 0.5,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: T.bg,
              border: `1.5px solid ${T.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Inbox size={22} color={T.textSecondary} />
          </div>
          <p style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.empty}</p>
          <p style={{ ...TYPE.caption, color: T.textTertiary, marginTop: 5 }}>{t.emptyDesc}</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map((n, idx) => {
            const cat = categorize(n);
            const notifType = n.data?.type ?? '';
            const style = categoryStyle(cat, notifType);
            const Icon = style.Icon;
            const followerProfileId = n.data?.follower_profile_id ?? n.data?.profile_id;
            const isFollowNotif = (notifType === 'new_follower' || notifType === 'mutual_follow') && followerProfileId;
            const followState = followerProfileId ? followStates[followerProfileId] : undefined;
            const isUnread = !n.read_at;
            const time = new Date(n.sent_at ?? n.created_at).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' });

            return (
              <li key={n.id}>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * idx, duration: 0.28 }}
                  onClick={() => {
                    haptic('selection');
                    markRead(n.id);
                    if (isFollowNotif && followerProfileId) navigateToProfile(followerProfileId);
                  }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    width: '100%',
                    padding: `14px ${PAGE_PADDING_X}px 14px ${PAGE_PADDING_X + 8}px`,
                    background: T.surface,
                    border: 'none',
                    borderBottom: `1px solid ${T.border}`,
                    borderTop: idx === 0 ? `1px solid ${T.border}` : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  {/* unread dot */}
                  {isUnread && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: T.accent,
                      }}
                    />
                  )}

                  {/* round colored icon */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: style.bg,
                      color: style.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} strokeWidth={2} color={style.color} />
                  </div>

                  {/* body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: 10, color: T.textTertiary, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 500 }}>
                        {time}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: T.textSecondary,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        margin: 0,
                      }}
                    >
                      {n.body}
                    </p>

                    {/* follow-back action chip for new_follower */}
                    {isFollowNotif && notifType === 'new_follower' && followerProfileId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFollow(followerProfileId);
                        }}
                        disabled={followState === 'loading'}
                        style={{
                          marginTop: 7,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '4px 10px',
                          borderRadius: 9999,
                          border: `1.5px solid ${followState === true ? T.border : T.accent}`,
                          background: followState === true ? T.surface : T.accentSoft,
                          color: followState === true ? T.text : T.accent,
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: followState === 'loading' ? 'wait' : 'pointer',
                          fontFamily: 'inherit',
                          opacity: followState === 'loading' ? 0.6 : 1,
                        }}
                      >
                        {followState === 'loading' ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : followState === true ? (
                          <><UserCheck size={10} strokeWidth={2.5} /> {t.mutual}</>
                        ) : (
                          <><UserPlus size={10} strokeWidth={2.5} /> {t.follow}</>
                        )}
                      </button>
                    )}

                    {/* Mutual badge */}
                    {notifType === 'mutual_follow' && (
                      <span
                        style={{
                          marginTop: 7,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '4px 10px',
                          borderRadius: 9999,
                          border: `1.5px solid ${T.success}`,
                          background: T.successSoft,
                          color: T.success,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {t.mutual}
                      </span>
                    )}
                  </div>
                </motion.button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
