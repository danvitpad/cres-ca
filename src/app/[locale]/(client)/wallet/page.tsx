/** --- YAML
 * name: ClientWalletPage
 * description: Client wallet — balance, bonus points, referral program, gift cards, saved payment methods
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, Check, Gift, CreditCard, Plus, Sparkles, UserPlus, TrendingUp, Send, Target, ArrowDownLeft, ArrowUpRight, X as XIcon } from 'lucide-react';
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

interface SavingsGoal {
  title: string;
  target: number;
}

export default function WalletPage() {
  const t = useTranslations('clientWallet');
  const tc = useTranslations('common');
  const { userId } = useAuthStore();
  const [data, setData] = useState<WalletData | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [goalDraft, setGoalDraft] = useState({ title: '', target: '' });
  const [goalEditing, setGoalEditing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, bonus_balance, bonus_points, lifetime_bonus')
        .eq('id', userId)
        .maybeSingle();

      setData({
        balance: profile?.bonus_balance ?? 0,
        bonusPoints: profile?.bonus_points ?? 0,
        lifetimeEarned: profile?.lifetime_bonus ?? 0,
        referralCode: (userId ?? '').slice(0, 8).toUpperCase(),
        invitedCount: 0,
        referralEarned: 0,
      });

      // Build timeline from referrals (in) + recent paid appointments (out)
      const items: TimelineItem[] = [];
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, bonus_points, created_at, referee_name')
        .eq('referrer_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      refs?.forEach((r: { id: string; bonus_points: number | null; created_at: string; referee_name: string | null }) => {
        items.push({
          id: `ref-${r.id}`,
          kind: 'in',
          title: r.referee_name ? `+ ${r.referee_name}` : 'Referral bonus',
          amount: r.bonus_points ?? 0,
          at: r.created_at,
        });
      });

      const { data: clientRows } = await supabase.from('clients').select('id').eq('profile_id', userId);
      const clientIds = clientRows?.map((c: { id: string }) => c.id) ?? [];
      if (clientIds.length) {
        const { data: spent } = await supabase
          .from('appointments')
          .select('id, price, currency, starts_at, status, service:services(name)')
          .in('client_id', clientIds)
          .eq('status', 'completed')
          .order('starts_at', { ascending: false })
          .limit(10);
        spent?.forEach((row) => {
          const a = row as unknown as { id: string; price: number | null; starts_at: string; service: { name: string } | { name: string }[] | null };
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

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setTimeline(items.slice(0, 15));

      try {
        const raw = localStorage.getItem(`cres-ca-goal-${userId}`);
        if (raw) setGoal(JSON.parse(raw));
      } catch {}

      setLoading(false);
    }
    load();
  }, [userId]);

  function saveGoal() {
    const target = Number(goalDraft.target);
    if (!goalDraft.title.trim() || !target || target <= 0) {
      toast.error(t('goalInvalid'));
      return;
    }
    const g: SavingsGoal = { title: goalDraft.title.trim(), target };
    setGoal(g);
    setGoalEditing(false);
    try { localStorage.setItem(`cres-ca-goal-${userId}`, JSON.stringify(g)); } catch {}
  }

  function clearGoal() {
    setGoal(null);
    try { localStorage.removeItem(`cres-ca-goal-${userId}`); } catch {}
  }

  async function submitTransfer() {
    if (!data) return;
    const amount = Number(transferAmount);
    if (!transferTo.trim() || !amount || amount <= 0) {
      toast.error(t('transferInvalid'));
      return;
    }
    if (amount > data.balance) {
      toast.error(t('transferInsufficient'));
      return;
    }
    setTransferBusy(true);
    const supabase = createClient();
    // Try to find recipient by email or referral code (best-effort, no destructive RPC)
    const { data: rcpt } = await supabase
      .from('profiles')
      .select('id, full_name, bonus_balance')
      .or(`email.eq.${transferTo.trim()},id.ilike.${transferTo.trim().toLowerCase()}%`)
      .maybeSingle();
    if (!rcpt) {
      toast.error(t('transferNotFound'));
      setTransferBusy(false);
      return;
    }
    const { error: e1 } = await supabase
      .from('profiles')
      .update({ bonus_balance: data.balance - amount })
      .eq('id', userId!);
    if (e1) {
      toast.error(e1.message);
      setTransferBusy(false);
      return;
    }
    await supabase
      .from('profiles')
      .update({ bonus_balance: (rcpt.bonus_balance ?? 0) + amount })
      .eq('id', rcpt.id);
    setData({ ...data, balance: data.balance - amount });
    toast.success(t('transferDone'));
    setTransferOpen(false);
    setTransferTo('');
    setTransferAmount('');
    setTransferBusy(false);
  }

  const goalProgress = useMemo(() => {
    if (!goal || !data) return 0;
    return Math.min(100, Math.round((data.balance / goal.target) * 100));
  }, [goal, data]);

  function copyReferral() {
    if (!data) return;
    const link = `${window.location.origin}/invite/${data.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 2000);
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
      </div>

      <Tabs defaultValue="balance" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-[700px]">
          <TabsTrigger value="balance">{t('tab_balance')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('tab_timeline')}</TabsTrigger>
          <TabsTrigger value="referrals">{t('tab_referrals')}</TabsTrigger>
          <TabsTrigger value="giftCards">{t('tab_giftCards')}</TabsTrigger>
          <TabsTrigger value="cards">{t('tab_cards')}</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-6 space-y-6">
          {/* Premium hero — animated mesh, oversized number, chip-card aesthetic */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-[28px] bg-[#0b0b14] p-8 text-white shadow-[0_30px_80px_-30px_rgba(80,30,180,0.55)]"
          >
            {/* Animated gradient mesh */}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{t('balance')}</p>
                <p className="font-bold tracking-tight text-white" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1 }}>
                  {data.balance.toFixed(2)} <span className="text-2xl font-medium text-white/70">₴</span>
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                    +{data.bonusPoints} {t('bonusPoints').toLowerCase()}
                  </span>
                  <span className="text-[11px] text-white/60">·</span>
                  <span className="text-[11px] text-white/60">{t('lifetimeEarned')}: {data.lifetimeEarned.toFixed(0)} ₴</span>
                </div>
              </div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/12 backdrop-blur ring-1 ring-white/15">
                <Sparkles className="size-7" />
              </div>
            </div>

            <div className="relative mt-7 flex gap-2">
              <button className="group inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0b0b14] transition-all hover:scale-[1.02]">
                <Plus className="size-4" /> {t('topUp')}
              </button>
              <button
                onClick={() => setTransferOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/10"
              >
                <Send className="size-4" /> {t('transfer')}
              </button>
            </div>
          </motion.div>

          {/* Quick action tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickTile icon={Plus} label={t('topUp')} accent="violet" />
            <QuickTile icon={Send} label={t('transfer')} accent="rose" onClick={() => setTransferOpen(true)} />
            <QuickTile icon={Gift} label={t('buyGiftCard')} accent="amber" />
            <QuickTile icon={UserPlus} label={t('referralProgram')} accent="emerald" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={TrendingUp} label={t('lifetimeEarned')} value={`${data.lifetimeEarned.toFixed(2)} ₴`} />
            <StatCard icon={UserPlus} label={t('invitedFriends')} value={String(data.invitedCount)} />
          </div>

          {/* Savings goal */}
          <div className="rounded-3xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Target className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{t('savingsGoalTitle')}</h3>
                  <p className="text-xs text-muted-foreground">{t('savingsGoalDesc')}</p>
                </div>
              </div>
              {goal && !goalEditing && (
                <Button size="sm" variant="ghost" onClick={clearGoal}>
                  <XIcon className="size-4" />
                </Button>
              )}
            </div>

            {goalEditing || !goal ? (
              <div className="mt-5 space-y-3">
                <input
                  value={goalDraft.title}
                  onChange={(e) => setGoalDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder={t('goalTitlePh')}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={goalDraft.target}
                  onChange={(e) => setGoalDraft((d) => ({ ...d, target: e.target.value }))}
                  placeholder={t('goalAmountPh')}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <Button onClick={saveGoal} size="sm">{t('goalSave')}</Button>
                  {goal && (
                    <Button onClick={() => setGoalEditing(false)} size="sm" variant="ghost">
                      {tc('cancel')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">{goal.title}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {data.balance.toFixed(0)} / {goal.target.toFixed(0)} ₴
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goalProgress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">{goalProgress}%</span>
                  <button onClick={() => { setGoalEditing(true); setGoalDraft({ title: goal.title, target: String(goal.target) }); }} className="text-muted-foreground hover:text-foreground">
                    {tc('edit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="rounded-3xl border bg-card p-6">
            <h2 className="text-base font-semibold">{t('timelineTitle')}</h2>
            {timeline.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t('timelineEmpty')}</p>
            ) : (
              <ul className="mt-5 space-y-1">
                {timeline.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/40">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${
                        item.kind === 'in' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                      }`}
                    >
                      {item.kind === 'in' ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${item.kind === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.kind === 'in' ? '+' : '−'}{item.amount.toFixed(0)} ₴
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="mt-6">
          <div className="rounded-3xl border bg-card p-8">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserPlus className="size-7" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">{t('referralProgram')}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('referralDesc')}</p>

            <div className="mt-6 flex items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-4 max-w-md">
              <code className="flex-1 truncate font-mono text-sm">
                {typeof window !== 'undefined' ? window.location.origin : ''}/invite/{data.referralCode}
              </code>
              <Button size="sm" onClick={copyReferral}>
                {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                {copied ? t('copied') : t('copyLink')}
              </Button>
            </div>

            <div className="mt-6 grid max-w-md gap-3 sm:grid-cols-2">
              <StatCard icon={UserPlus} label={t('invitedFriends')} value={String(data.invitedCount)} />
              <StatCard icon={Sparkles} label={t('earnedFromReferrals')} value={`${data.referralEarned.toFixed(2)} ₴`} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="giftCards" className="mt-6">
          <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Gift className="size-8" />
            </div>
            <p className="mt-5 text-base font-semibold">{t('noGiftCards')}</p>
            <div className="mt-6 flex gap-2">
              <Button>{t('buyGiftCard')}</Button>
              <Button variant="outline">{t('sendGift')}</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cards" className="mt-6">
          <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard className="size-8" />
            </div>
            <p className="mt-5 text-base font-semibold">{t('noCards')}</p>
            <Button className="mt-6">
              <Plus className="mr-1 size-4" /> {t('addCard')}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {transferOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => !transferBusy && setTransferOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{t('transferTitle')}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t('transferDesc')}</p>
                </div>
                <button onClick={() => setTransferOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                  <XIcon className="size-4" />
                </button>
              </div>
              <input
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder={t('transferToPh')}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="number"
                inputMode="decimal"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder={t('transferAmountPh')}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('transferAvailable')}: <span className="font-semibold text-foreground">{data.balance.toFixed(2)} ₴</span>
              </p>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" disabled={transferBusy} onClick={() => setTransferOpen(false)}>
                  {tc('cancel')}
                </Button>
                <Button className="flex-1" disabled={transferBusy} onClick={submitTransfer}>
                  {transferBusy ? '…' : t('transferSend')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
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

const tileAccents: Record<string, string> = {
  violet: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-300',
  rose: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-300',
  amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-300',
  emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300',
};

function QuickTile({
  icon: Icon,
  label,
  accent,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: 'violet' | 'rose' | 'amber' | 'emerald';
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-start gap-3 rounded-2xl border bg-gradient-to-br ${tileAccents[accent]} p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]`}
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-background/70 backdrop-blur ring-1 ring-border/60">
        <Icon className="size-5" />
      </div>
      <span className="text-xs font-semibold leading-tight text-foreground">{label}</span>
    </button>
  );
}
