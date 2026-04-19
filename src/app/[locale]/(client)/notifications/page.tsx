/** --- YAML
 * name: ClientNotificationsPage
 * description: Notification preferences — channels (telegram/email/sms/push), booking reminders, marketing, waitlist alerts
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Send, Mail, MessageSquare, Smartphone, Clock, Megaphone, Bell, Inbox, Calendar, Sparkles, Star, Sliders, UserPlus, UserCheck, Users, Loader2, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface NotifData {
  type?: string;
  follower_profile_id?: string;
  profile_id?: string;
  [key: string]: unknown;
}

interface NotifRow {
  id: string;
  title: string | null;
  body: string | null;
  channel: string | null;
  status: string | null;
  created_at: string;
  read_at: string | null;
  data: NotifData | null;
}

interface Prefs {
  telegram: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  reminder_day: boolean;
  reminder_2h: boolean;
  marketing_promos: boolean;
  marketing_news: boolean;
  marketing_birthday: boolean;
  waitlist_alerts: boolean;
  review_requests: boolean;
}

const defaults: Prefs = {
  telegram: true,
  email: false,
  sms: false,
  push: true,
  reminder_day: true,
  reminder_2h: true,
  marketing_promos: false,
  marketing_news: true,
  marketing_birthday: true,
  waitlist_alerts: true,
  review_requests: true,
};

type Category = 'all' | 'important' | 'bookings' | 'reminders' | 'promos' | 'reviews';

function categorize(n: NotifRow): Exclude<Category, 'all' | 'important'> | 'system' | 'social' {
  if (n.data?.type === 'new_follower' || n.data?.type === 'mutual_follow') return 'social';
  const text = `${n.title ?? ''} ${n.body ?? ''}`.toLowerCase();
  if (/cancel|cancelled|booking|appointment|записал|отмен|подтвержд/.test(text)) return 'bookings';
  if (/remind|reminder|reminded|напомин/.test(text)) return 'reminders';
  if (/review|отзыв/.test(text)) return 'reviews';
  if (/burning|promo|sale|акци|скидк|burning|🎉/.test(text)) return 'promos';
  return 'system';
}

const CATEGORY_META: Record<Exclude<Category, 'all' | 'important'> | 'system' | 'social', { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  bookings: { icon: Calendar, color: 'oklch(0.65 0.2 264)' },
  reminders: { icon: Clock, color: 'oklch(0.7 0.18 75)' },
  promos: { icon: Sparkles, color: 'oklch(0.65 0.22 320)' },
  reviews: { icon: Star, color: 'oklch(0.75 0.18 75)' },
  social: { icon: UserPlus, color: 'oklch(0.65 0.18 250)' },
  system: { icon: Bell, color: 'oklch(0.6 0 0)' },
};

export default function NotificationsPage() {
  const t = useTranslations('clientNotifications');
  const { userId } = useAuthStore();
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const [dirty, setDirty] = useState(false);
  const [feed, setFeed] = useState<NotifRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [category, setCategory] = useState<Category>('all');
  const [followStates, setFollowStates] = useState<Record<string, boolean | 'loading'>>({});

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();
      if (data) setPrefs({ ...defaults, ...data });
    }
    async function loadFeed() {
      const supabase = createClient();
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, channel, status, created_at, read_at, data')
        .eq('profile_id', userId)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      setFeed((data ?? []) as NotifRow[]);

      // Check follow states for new_follower notifications
      const followerIds = (data ?? [])
        .filter((n: { data: NotifData | null }) => n.data?.type === 'new_follower' && n.data?.follower_profile_id)
        .map((n: { data: NotifData }) => n.data.follower_profile_id as string);

      if (followerIds.length > 0 && userId) {
        const { data: myFollows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId)
          .in('following_id', followerIds);
        const followingSet = new Set((myFollows ?? []).map(f => f.following_id));
        const states: Record<string, boolean> = {};
        for (const fId of followerIds) {
          states[fId] = followingSet.has(fId);
        }
        setFollowStates(states);
      }

      setFeedLoading(false);
    }
    load();
    loadFeed();
  }, [userId]);

  function cleanBody(body: string | null) {
    return body?.replace(/\[(review|waitlist|burning|cancel):[^\]]+\]/gi, '').trim() ?? '';
  }

  function toggle<K extends keyof Prefs>(k: K) {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
    setDirty(true);
  }

  async function save() {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase.from('notification_prefs').upsert({
      profile_id: userId,
      ...prefs,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success('✓');
      setDirty(false);
    }
  }

  async function dismissOne(id: string) {
    setFeed((prev) => prev.filter((n) => n.id !== id));
    const supabase = createClient();
    await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
  }

  async function dismissAll() {
    if (!userId) return;
    setFeed([]);
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('profile_id', userId)
      .is('dismissed_at', null);
  }

  async function markAllRead() {
    if (!userId) return;
    const now = new Date().toISOString();
    setFeed((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('profile_id', userId)
      .is('read_at', null);
  }

  async function toggleFollow(targetId: string) {
    setFollowStates(prev => ({ ...prev, [targetId]: 'loading' }));
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFollowStates(prev => ({ ...prev, [targetId]: data.following }));
        toast.success(data.following ? 'Подписка оформлена' : 'Подписка отменена');
      }
    } catch {
      setFollowStates(prev => ({ ...prev, [targetId]: false }));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('desc')}</p>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList>
          <TabsTrigger value="inbox">{t('inboxTab')}</TabsTrigger>
          <TabsTrigger value="settings">{t('settingsTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-6 space-y-4">
          {/* Toolbar */}
          {feed.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              {feed.some((n) => !n.read_at) && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
                >
                  <Check className="size-3" />
                  {t('markAllRead')}
                </button>
              )}
              <button
                onClick={dismissAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-rose-600 hover:border-rose-500/40"
              >
                <X className="size-3" />
                {t('clearAll')}
              </button>
            </div>
          )}
          {/* Category filter chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {(['all', 'important', 'bookings', 'reminders', 'promos', 'reviews'] as const).map((c) => {
              const isActive = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-all',
                    isActive
                      ? 'border-[var(--ds-accent)] bg-[var(--ds-accent)] text-white shadow-sm'
                      : 'border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30',
                  )}
                >
                  {c === 'important' && <Sliders className="mr-1 inline-block size-3" />}
                  {t(`filter_${c}`)}
                </button>
              );
            })}
          </div>

          {feedLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : (() => {
            // Filter
            const filtered = feed.filter((n) => {
              if (category === 'all') return true;
              const cat = categorize(n);
              if (category === 'important') return cat === 'bookings' || cat === 'reminders';
              return cat === category;
            });

            if (filtered.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card p-12 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Inbox className="size-8" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{t('inboxEmpty')}</p>
                </div>
              );
            }

            // Group by date label
            const groups = new Map<string, NotifRow[]>();
            const todayStr = new Date().toDateString();
            const yStr = new Date(Date.now() - 86400000).toDateString();
            for (const n of filtered) {
              const ds = new Date(n.created_at).toDateString();
              const label = ds === todayStr ? t('today') : ds === yStr ? t('yesterday') : new Date(n.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
              if (!groups.has(label)) groups.set(label, []);
              groups.get(label)!.push(n);
            }

            return (
              <div className="space-y-5">
                {[...groups.entries()].map(([label, items]) => (
                  <div key={label} className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    {items.map((n) => {
                      const cat = categorize(n);
                      const meta = CATEGORY_META[cat];
                      const notifType = n.data?.type ?? '';
                      const followerProfileId = n.data?.follower_profile_id ?? n.data?.profile_id;
                      const isFollowNotif = (notifType === 'new_follower' || notifType === 'mutual_follow') && followerProfileId;
                      const followState = followerProfileId ? followStates[followerProfileId] : undefined;
                      const Icon = notifType === 'mutual_follow' ? Users : notifType === 'new_follower' ? UserPlus : meta.icon;
                      return (
                        <div key={n.id} className={cn(
                          'group/notif flex gap-3 rounded-2xl border p-4 transition-all hover:shadow-sm',
                          n.read_at ? 'border-border/60 bg-card' : 'border-[var(--ds-accent)]/30 bg-[var(--ds-accent)]/5',
                          'hover:border-[var(--ds-accent)]/40',
                        )}>
                          <div
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)`, color: meta.color }}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-snug">{n.title}</p>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {n.body && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{cleanBody(n.body)}</p>}
                          </div>

                          {/* Follow-back button for new_follower */}
                          {isFollowNotif && notifType === 'new_follower' && followerProfileId && (
                            <button
                              onClick={() => toggleFollow(followerProfileId)}
                              disabled={followState === 'loading'}
                              className={cn(
                                'shrink-0 flex items-center gap-1.5 self-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60',
                                followState === true
                                  ? 'border border-border bg-card text-muted-foreground'
                                  : 'bg-[var(--ds-accent)] text-white',
                              )}
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
                            <span className="shrink-0 self-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Взаимно
                            </span>
                          )}

                          {/* Dismiss */}
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissOne(n.id); }}
                            aria-label={t('dismiss')}
                            className="shrink-0 self-center rounded-full p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/notif:opacity-100"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-6">
      <Section title={t('channels')}>
        <Row
          icon={Send}
          title={t('telegram')}
          desc={t('telegramDesc')}
          checked={prefs.telegram}
          onToggle={() => toggle('telegram')}
          highlighted
          action={
            !prefs.telegram && (
              <Button size="sm" variant="outline">
                {t('connectTelegram')}
              </Button>
            )
          }
        />
        <Row icon={Mail} title={t('email')} checked={prefs.email} onToggle={() => toggle('email')} />
        <Row icon={MessageSquare} title={t('sms')} checked={prefs.sms} onToggle={() => toggle('sms')} />
        <Row icon={Smartphone} title={t('push')} checked={prefs.push} onToggle={() => toggle('push')} />
      </Section>

      <Section title={t('bookingReminders')}>
        <Row icon={Clock} title={t('reminderDay')} checked={prefs.reminder_day} onToggle={() => toggle('reminder_day')} />
        <Row icon={Clock} title={t('reminder2h')} checked={prefs.reminder_2h} onToggle={() => toggle('reminder_2h')} />
      </Section>

      <Section title={t('marketing')}>
        <Row icon={Megaphone} title={t('marketingPromos')} checked={prefs.marketing_promos} onToggle={() => toggle('marketing_promos')} />
        <Row icon={Megaphone} title={t('marketingNews')} checked={prefs.marketing_news} onToggle={() => toggle('marketing_news')} />
        <Row icon={Megaphone} title={t('marketingBirthday')} checked={prefs.marketing_birthday} onToggle={() => toggle('marketing_birthday')} />
      </Section>

      <Section title={t('waitlistAlerts')}>
        <Row icon={Bell} title={t('waitlistAlertsDesc')} checked={prefs.waitlist_alerts} onToggle={() => toggle('waitlist_alerts')} />
        <Row icon={Bell} title={t('reviewRequests')} checked={prefs.review_requests} onToggle={() => toggle('review_requests')} />
      </Section>

      {dirty && (
        <div className="sticky bottom-6 flex justify-end">
          <Button onClick={save} size="lg" className="shadow-lg">
            {t('saveChanges')}
          </Button>
        </div>
      )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card overflow-hidden">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  checked,
  onToggle,
  highlighted,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  checked: boolean;
  onToggle: () => void;
  highlighted?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-4 px-6 py-4 ${highlighted ? 'bg-primary/5' : ''}`}>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${highlighted ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      {action}
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}
