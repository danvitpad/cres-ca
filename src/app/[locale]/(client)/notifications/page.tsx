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
import { Send, Mail, MessageSquare, Smartphone, Clock, Megaphone, Bell, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface NotifRow {
  id: string;
  title: string | null;
  body: string | null;
  channel: string | null;
  status: string | null;
  created_at: string;
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

export default function NotificationsPage() {
  const t = useTranslations('clientNotifications');
  const { userId } = useAuthStore();
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const [dirty, setDirty] = useState(false);
  const [feed, setFeed] = useState<NotifRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

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
        .select('id, title, body, channel, status, created_at')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      setFeed((data ?? []) as NotifRow[]);
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

        <TabsContent value="inbox" className="mt-6 space-y-3">
          {feedLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-8" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t('inboxEmpty')}</p>
            </div>
          ) : (
            feed.map((n) => (
              <div key={n.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {n.body && <p className="mt-1 text-xs text-muted-foreground">{cleanBody(n.body)}</p>}
              </div>
            ))
          )}
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
