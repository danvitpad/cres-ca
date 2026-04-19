/** --- YAML
 * name: ClientWalletPage
 * description: Кошелёк клиента — баланс бонусов, история операций, реферальная программа.
 * created: 2026-04-12
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Sparkles,
  UserPlus,
  Star,
  CalendarCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Share2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface WalletData {
  balance: number;
  bonusPoints: number;
  lifetimeEarned: number;
  referralCode: string;
  invitedCount: number;
  referralEarned: number;
}

interface TimelineItem {
  id: string;
  kind: 'in' | 'out';
  title: string;
  amount: number;
  at: string;
}

interface FamilyBudgetRow {
  name: string;
  relationship: string;
  visits: number;
  total: number;
}

export default function WalletPage() {
  const t = useTranslations('clientWallet');
  const { userId } = useAuthStore();
  const [data, setData] = useState<WalletData | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [familyBudget, setFamilyBudget] = useState<FamilyBudgetRow[]>([]);
  const [familyTotal, setFamilyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, bonus_balance, bonus_points, lifetime_bonus, referral_code')
        .eq('id', userId)
        .maybeSingle();

      const code =
        (profile?.referral_code as string | null) ??
        (userId ?? '').slice(0, 8).toUpperCase();

      const { data: refList } = await supabase
        .from('referrals')
        .select('id, bonus_points, created_at, referee_name')
        .eq('referrer_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      const invited = refList?.length ?? 0;
      const refEarned =
        (refList ?? []).reduce((s, r) => s + Number(r.bonus_points ?? 0), 0);

      setData({
        balance: Number(profile?.bonus_balance ?? 0),
        bonusPoints: Number(profile?.bonus_points ?? 0),
        lifetimeEarned: Number(profile?.lifetime_bonus ?? 0),
        referralCode: code,
        invitedCount: invited,
        referralEarned: refEarned,
      });

      const items: TimelineItem[] = [];
      (refList ?? []).forEach((r) => {
        items.push({
          id: `ref-${r.id}`,
          kind: 'in',
          title: r.referee_name ? `+ ${r.referee_name}` : t('timelineRefBonus'),
          amount: Number(r.bonus_points ?? 0),
          at: r.created_at,
        });
      });

      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', userId);
      const clientIds = clientRows?.map((c: { id: string }) => c.id) ?? [];
      if (clientIds.length) {
        const { data: spent } = await supabase
          .from('appointments')
          .select('id, price, starts_at, status, service:services(name)')
          .in('client_id', clientIds)
          .eq('status', 'completed')
          .order('starts_at', { ascending: false })
          .limit(10);
        spent?.forEach((row) => {
          const a = row as unknown as {
            id: string;
            price: number | null;
            starts_at: string;
            service: { name: string } | { name: string }[] | null;
          };
          const svc = Array.isArray(a.service) ? a.service[0] : a.service;
          items.push({
            id: `apt-${a.id}`,
            kind: 'out',
            title: svc?.name ?? '—',
            amount: Number(a.price ?? 0),
            at: a.starts_at,
          });
        });
      }

      const { data: walletTx } = await supabase
        .from('wallet_transactions')
        .select('id, kind, amount, reason, created_at')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      (walletTx ?? []).forEach((tx) => {
        const amt = Number(tx.amount);
        items.push({
          id: `wtx-${tx.id}`,
          kind: amt >= 0 ? 'in' : 'out',
          title: tx.reason ?? (amt >= 0 ? t('timelineRefBonus') : t('timelineSpent')),
          amount: Math.abs(amt),
          at: tx.created_at,
        });
      });

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setTimeline(items.slice(0, 20));

      const { data: links } = await supabase
        .from('family_links')
        .select('id, member_name, relationship, linked_profile_id')
        .eq('parent_profile_id', userId);

      if (links && links.length > 0) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const memberProfileIds = links
          .map((l: { linked_profile_id: string | null }) => l.linked_profile_id)
          .filter((id): id is string => !!id);
        const allProfileIds = [userId, ...memberProfileIds];
        const { data: allClients } = await supabase
          .from('clients')
          .select('id, profile_id, family_link_id')
          .in('profile_id', allProfileIds);
        const allClientIds = (allClients ?? []).map((c: { id: string }) => c.id);
        const { data: apts } = allClientIds.length === 0
          ? { data: [] }
          : await supabase
              .from('appointments')
              .select('id, client_id, price, starts_at, family_link_id')
              .in('client_id', allClientIds)
              .eq('status', 'completed')
              .gte('starts_at', ninetyDaysAgo.toISOString());

        type AptRow = {
          id: string;
          client_id: string;
          price: number | null;
          starts_at: string;
          family_link_id: string | null;
        };
        const clientById = new Map(
          (allClients ?? []).map(
            (c: { id: string; profile_id: string | null; family_link_id: string | null }) => [c.id, c],
          ),
        );

        const rows: FamilyBudgetRow[] = [];
        const selfAgg = { visits: 0, total: 0 };
        const perLink = new Map<string, { visits: number; total: number }>();

        for (const a of (apts ?? []) as AptRow[]) {
          const price = Number(a.price ?? 0);
          const key = a.family_link_id || clientById.get(a.client_id)?.family_link_id;
          if (key) {
            const cur = perLink.get(key) ?? { visits: 0, total: 0 };
            cur.visits += 1;
            cur.total += price;
            perLink.set(key, cur);
          } else {
            const client = clientById.get(a.client_id);
            if (client?.profile_id === userId) {
              selfAgg.visits += 1;
              selfAgg.total += price;
            }
          }
        }

        rows.push({
          name: t('familySelf'),
          relationship: 'self',
          visits: selfAgg.visits,
          total: selfAgg.total,
        });
        for (const l of links as Array<{ id: string; member_name: string; relationship: string }>) {
          const agg = perLink.get(l.id) ?? { visits: 0, total: 0 };
          rows.push({
            name: l.member_name,
            relationship: l.relationship,
            visits: agg.visits,
            total: agg.total,
          });
        }

        setFamilyBudget(rows);
        setFamilyTotal(rows.reduce((s, r) => s + r.total, 0));
      }

      setLoading(false);
    }
    load();
  }, [userId, t]);

  const referralLink = useMemo(() => {
    if (!data || typeof window === 'undefined') return '';
    return `${window.location.origin}/ref/${data.referralCode}`;
  }, [data]);

  function copyReferral() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareReferral() {
    if (!referralLink) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: t('referralProgram'),
          text: t('referralDesc'),
          url: referralLink,
        });
        return;
      } catch {}
    }
    copyReferral();
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
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
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="balance" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[520px]">
          <TabsTrigger value="balance">{t('tab_balance')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('tab_timeline')}</TabsTrigger>
          <TabsTrigger value="referrals">{t('tab_referrals')}</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-[28px] bg-[#0b0b14] p-8 text-white shadow-[0_30px_80px_-30px_rgba(80,30,180,0.55)]"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
              className="pointer-events-none absolute -inset-[40%] opacity-80"
              style={{
                background:
                  'conic-gradient(from 90deg at 50% 50%, #6d28d9 0%, #db2777 25%, #f59e0b 50%, #6d28d9 75%, #6d28d9 100%)',
                filter: 'blur(80px)',
              }}
            />
            <div className="absolute inset-0 bg-[#0b0b14]/55" />
            <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="relative flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  {t('balance')}
                </p>
                <p
                  className="font-bold tracking-tight text-white"
                  style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1 }}
                >
                  {data.bonusPoints.toFixed(0)}{' '}
                  <span className="text-2xl font-medium text-white/70">
                    {t('bonusPoints').toLowerCase()}
                  </span>
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                    {t('lifetimeEarned')}: {data.lifetimeEarned.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/12 backdrop-blur ring-1 ring-white/15">
                <Sparkles className="size-7" />
              </div>
            </div>

            <div className="relative mt-7 flex gap-2">
              <button
                onClick={shareReferral}
                className="group inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0b0b14] transition-all hover:scale-[1.02]"
              >
                <UserPlus className="size-4" /> {t('referralProgram')}
              </button>
              <button
                onClick={copyReferral}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/10"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t('copied') : t('copyLink')}
              </button>
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border bg-card p-6">
              <h3 className="text-sm font-semibold">{t('howEarnTitle')}</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <EarnRow
                  icon={UserPlus}
                  label={t('earnReferral')}
                  amount="+100"
                  tint="emerald"
                />
                <EarnRow
                  icon={Star}
                  label={t('earnReview')}
                  amount="+20"
                  tint="amber"
                />
                <EarnRow
                  icon={CalendarCheck}
                  label={t('earnLoyalty')}
                  amount="+50"
                  tint="violet"
                />
              </ul>
            </div>

            <div className="rounded-3xl border bg-card p-6">
              <h3 className="text-sm font-semibold">{t('howSpendTitle')}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{t('howSpendDesc')}</p>
              <div className="mt-5 rounded-2xl bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
                {t('spendRatio')}
              </div>
            </div>
          </div>

          {familyBudget.length > 0 && (
            <div className="rounded-3xl border bg-gradient-to-br from-violet-500/8 via-card to-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{t('familyBudgetTitle')}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('familyBudgetDesc')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t('familyPeriod90d')}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {familyTotal.toFixed(0)} ₴
                  </p>
                </div>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {familyBudget.map((row, i) => (
                  <li
                    key={`${row.name}-${i}`}
                    className="relative overflow-hidden rounded-2xl border bg-background/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.name}</p>
                        <p className="text-[11px] capitalize text-muted-foreground">
                          {row.relationship}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
                        {row.visits} {t('familyVisits')}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-bold tabular-nums">
                      {row.total.toFixed(0)} ₴
                    </p>
                    {familyTotal > 0 && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, (row.total / familyTotal) * 100)}%`,
                          }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="rounded-3xl border bg-card p-6">
            <h2 className="text-base font-semibold">{t('timelineTitle')}</h2>
            {timeline.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t('timelineEmpty')}</p>
            ) : (
              <ul className="mt-5 space-y-1">
                {timeline.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${
                        item.kind === 'in'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-rose-500/15 text-rose-500'
                      }`}
                    >
                      {item.kind === 'in' ? (
                        <ArrowDownLeft className="size-5" />
                      ) : (
                        <ArrowUpRight className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        item.kind === 'in' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {item.kind === 'in' ? '+' : '−'}
                      {item.amount.toFixed(0)} ₴
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="mt-6 space-y-6">
          <div className="rounded-3xl border bg-card p-8">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserPlus className="size-7" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">{t('referralProgram')}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('referralDesc')}
            </p>

            <div className="mt-6 flex items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-4 max-w-md">
              <code className="flex-1 truncate font-mono text-sm">{referralLink}</code>
              <Button size="sm" onClick={copyReferral}>
                {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                {copied ? t('copied') : t('copyLink')}
              </Button>
            </div>
            <div className="mt-3 flex max-w-md">
              <Button variant="outline" size="sm" onClick={shareReferral}>
                <Share2 className="mr-1 size-4" /> {t('share')}
              </Button>
            </div>

            <div className="mt-6 grid max-w-md gap-3 sm:grid-cols-2">
              <StatCard
                icon={UserPlus}
                label={t('invitedFriends')}
                value={String(data.invitedCount)}
              />
              <StatCard
                icon={Sparkles}
                label={t('earnedFromReferrals')}
                value={`${data.referralEarned.toFixed(0)} ₴`}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <p className="relative mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

const earnTints: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
};

function EarnRow({
  icon: Icon,
  label,
  amount,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  amount: string;
  tint: 'emerald' | 'amber' | 'violet';
}) {
  return (
    <li className="flex items-center gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${earnTints[tint]}`}>
        <Icon className="size-4" />
      </div>
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-primary">{amount}</span>
    </li>
  );
}
