/** --- YAML
 * name: ClientWalletPage
 * description: Client wallet — balance, bonus points, referral program, gift cards, saved payment methods
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, Check, Gift, CreditCard, Plus, Sparkles, UserPlus, TrendingUp, Send, Target, ArrowDownLeft, ArrowUpRight, X as XIcon, Users } from 'lucide-react';
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
  id: string;
  title: string;
  target: number;
  createdAt: string;
}

interface GoalAchievement {
  id: string;
  title: string;
  target: number;
  achievedAt: string;
}

interface GoalsStore {
  version: 2;
  goals: SavingsGoal[];
  achievements: GoalAchievement[];
}

interface FamilyBudgetRow {
  name: string;
  relationship: string;
  visits: number;
  total: number;
  last: string | null;
}

interface GiftCardRow {
  id: string;
  code: string;
  amount: number;
  currency: string;
  is_redeemed: boolean;
  sender_message: string | null;
  created_at: string;
  sender_profile_id: string | null;
  recipient_profile_id: string | null;
  sender_name?: string | null;
  recipient_name?: string | null;
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
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [achievements, setAchievements] = useState<GoalAchievement[]>([]);
  const [familyBudget, setFamilyBudget] = useState<FamilyBudgetRow[]>([]);
  const [familyTotal, setFamilyTotal] = useState(0);
  const [goalDraft, setGoalDraft] = useState({ title: '', target: '' });
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [giftSent, setGiftSent] = useState<GiftCardRow[]>([]);
  const [giftReceived, setGiftReceived] = useState<GiftCardRow[]>([]);
  const [sendGiftOpen, setSendGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftBusy, setGiftBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
          title: tx.reason ?? (amt >= 0 ? 'Bonus credited' : 'Bonus spent'),
          amount: Math.abs(amt),
          at: tx.created_at,
        });
      });

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setTimeline(items.slice(0, 20));

      // Family budget: aggregate completed spending per linked family member (last 90 days)
      const { data: links } = await supabase
        .from('family_links')
        .select('id, member_name, relationship, linked_profile_id')
        .eq('parent_profile_id', userId);

      if (links && links.length > 0) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Collect client_ids across self + all linked members
        const memberProfileIds = links
          .map((l: { linked_profile_id: string | null }) => l.linked_profile_id)
          .filter((id): id is string => !!id);
        const allProfileIds = [userId, ...memberProfileIds];
        const { data: allClients } = await supabase
          .from('clients')
          .select('id, profile_id, family_link_id')
          .in('profile_id', allProfileIds);
        const allClientIds = (allClients ?? []).map((c: { id: string }) => c.id);
        const { data: apts } = allClientIds.length === 0 ? { data: [] } : await supabase
          .from('appointments')
          .select('id, client_id, price, starts_at, family_link_id')
          .in('client_id', allClientIds)
          .eq('status', 'completed')
          .gte('starts_at', ninetyDaysAgo.toISOString());

        type AptRow = { id: string; client_id: string; price: number | null; starts_at: string; family_link_id: string | null };
        const clientById = new Map(
          (allClients ?? []).map((c: { id: string; profile_id: string | null; family_link_id: string | null }) => [c.id, c]),
        );

        const rows: FamilyBudgetRow[] = [];
        // "Self" row first
        const selfAgg = { visits: 0, total: 0, last: null as string | null };
        const perLink = new Map<string, { visits: number; total: number; last: string | null }>();

        for (const a of (apts ?? []) as AptRow[]) {
          const price = Number(a.price ?? 0);
          const isFamily = a.family_link_id || clientById.get(a.client_id)?.family_link_id;
          if (isFamily) {
            const key = isFamily;
            const cur = perLink.get(key) ?? { visits: 0, total: 0, last: null as string | null };
            cur.visits += 1;
            cur.total += price;
            if (!cur.last || a.starts_at > cur.last) cur.last = a.starts_at;
            perLink.set(key, cur);
          } else {
            const client = clientById.get(a.client_id);
            if (client?.profile_id === userId) {
              selfAgg.visits += 1;
              selfAgg.total += price;
              if (!selfAgg.last || a.starts_at > selfAgg.last) selfAgg.last = a.starts_at;
            }
          }
        }

        rows.push({
          name: t('familySelf'),
          relationship: 'self',
          visits: selfAgg.visits,
          total: selfAgg.total,
          last: selfAgg.last,
        });
        for (const l of links as Array<{ id: string; member_name: string; relationship: string }>) {
          const agg = perLink.get(l.id) ?? { visits: 0, total: 0, last: null };
          rows.push({
            name: l.member_name,
            relationship: l.relationship,
            visits: agg.visits,
            total: agg.total,
            last: agg.last,
          });
        }

        setFamilyBudget(rows);
        setFamilyTotal(rows.reduce((s, r) => s + r.total, 0));
      }

      // Gift cards (sent + received)
      const { data: gcSent } = await supabase
        .from('gift_certificates')
        .select('id, code, amount, currency, is_redeemed, sender_message, created_at, sender_profile_id, recipient_profile_id')
        .eq('sender_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      const { data: gcReceived } = await supabase
        .from('gift_certificates')
        .select('id, code, amount, currency, is_redeemed, sender_message, created_at, sender_profile_id, recipient_profile_id')
        .eq('recipient_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      setGiftSent((gcSent ?? []) as GiftCardRow[]);
      setGiftReceived((gcReceived ?? []) as GiftCardRow[]);

      try {
        const rawV2 = localStorage.getItem(`cres-ca-goals-${userId}`);
        if (rawV2) {
          const parsed = JSON.parse(rawV2) as GoalsStore;
          setGoals(parsed.goals ?? []);
          setAchievements(parsed.achievements ?? []);
        } else {
          // Migrate legacy single-goal format
          const rawV1 = localStorage.getItem(`cres-ca-goal-${userId}`);
          if (rawV1) {
            const legacy = JSON.parse(rawV1) as { title: string; target: number };
            if (legacy?.title && legacy?.target > 0) {
              const migrated: SavingsGoal[] = [{
                id: crypto.randomUUID(),
                title: legacy.title,
                target: legacy.target,
                createdAt: new Date().toISOString(),
              }];
              setGoals(migrated);
              localStorage.setItem(
                `cres-ca-goals-${userId}`,
                JSON.stringify({ version: 2, goals: migrated, achievements: [] } satisfies GoalsStore),
              );
            }
            localStorage.removeItem(`cres-ca-goal-${userId}`);
          }
        }
      } catch {}

      setLoading(false);
    }
    load();
  }, [userId]);

  function persistGoals(nextGoals: SavingsGoal[], nextAch: GoalAchievement[]) {
    try {
      localStorage.setItem(
        `cres-ca-goals-${userId}`,
        JSON.stringify({ version: 2, goals: nextGoals, achievements: nextAch } satisfies GoalsStore),
      );
    } catch {}
  }

  function addGoal() {
    const target = Number(goalDraft.target);
    if (!goalDraft.title.trim() || !target || target <= 0) {
      toast.error(t('goalInvalid'));
      return;
    }
    const g: SavingsGoal = {
      id: crypto.randomUUID(),
      title: goalDraft.title.trim(),
      target,
      createdAt: new Date().toISOString(),
    };
    const next = [...goals, g];
    setGoals(next);
    persistGoals(next, achievements);
    setGoalDraft({ title: '', target: '' });
    setGoalFormOpen(false);
  }

  function removeGoal(id: string) {
    const next = goals.filter((g) => g.id !== id);
    setGoals(next);
    persistGoals(next, achievements);
  }

  function achieveGoal(id: string) {
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    const ach: GoalAchievement = {
      id: g.id,
      title: g.title,
      target: g.target,
      achievedAt: new Date().toISOString(),
    };
    const nextGoals = goals.filter((x) => x.id !== id);
    const nextAch = [ach, ...achievements].slice(0, 50);
    setGoals(nextGoals);
    setAchievements(nextAch);
    persistGoals(nextGoals, nextAch);
    toast.success(t('savingsGoalTitle'));
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
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('wallet_transfer', {
      recipient_lookup: transferTo.trim(),
      amount,
    });
    if (rpcErr) {
      toast.error(rpcErr.message);
      setTransferBusy(false);
      return;
    }
    const res = rpcResult as { ok?: boolean; error?: string; new_balance?: number } | null;
    if (!res?.ok) {
      const errMap: Record<string, string> = {
        insufficient_funds: t('transferInsufficient'),
        recipient_not_found: t('transferNotFound'),
        invalid_amount: t('transferInvalid'),
        self_transfer: t('transferNotFound'),
        unauthorized: t('transferNotFound'),
      };
      toast.error(errMap[res?.error ?? ''] ?? t('transferNotFound'));
      setTransferBusy(false);
      return;
    }
    setData({ ...data, balance: res.new_balance ?? data.balance - amount });
    toast.success(t('transferDone'));
    setTransferOpen(false);
    setTransferTo('');
    setTransferAmount('');
    setTransferBusy(false);
  }

  async function submitSendGift() {
    if (!data) return;
    const amount = Math.floor(Number(giftAmount));
    if (!giftTo.trim() || !amount || amount <= 0) {
      toast.error(t('giftInvalid'));
      return;
    }
    if (amount > data.balance) {
      toast.error(t('transferInsufficient'));
      return;
    }
    setGiftBusy(true);
    try {
      const res = await fetch('/api/gift-cards/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: giftTo.trim(), amount, message: giftMessage.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error === 'insufficient_funds' ? t('transferInsufficient') : json.error ?? 'error');
        setGiftBusy(false);
        return;
      }
      toast.success(t('giftSent', { code: json.code }));
      setData({ ...data, balance: data.balance - amount });
      setGiftSent((prev) => [
        {
          id: json.id,
          code: json.code,
          amount,
          currency: 'UAH',
          is_redeemed: false,
          sender_message: giftMessage.trim() || null,
          created_at: new Date().toISOString(),
          sender_profile_id: userId ?? null,
          recipient_profile_id: null,
        },
        ...prev,
      ]);
      setSendGiftOpen(false);
      setGiftTo('');
      setGiftAmount('');
      setGiftMessage('');
    } catch {
      toast.error('error');
    }
    setGiftBusy(false);
  }

  function copyGiftCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(t('copied'));
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function progressFor(target: number): number {
    if (!data || !target) return 0;
    return Math.min(100, Math.round((data.balance / target) * 100));
  }

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
        <TabsList className="grid w-full grid-cols-6 max-w-[820px]">
          <TabsTrigger value="balance">{t('tab_balance')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('tab_timeline')}</TabsTrigger>
          <TabsTrigger value="family">{t('tab_family')}</TabsTrigger>
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
            <QuickTile icon={Plus} label={t('topUp')} accent="violet" onClick={() => toast.info(t('topUp'))} />
            <QuickTile icon={Send} label={t('transfer')} accent="rose" onClick={() => setTransferOpen(true)} />
            <QuickTile icon={Gift} label={t('sendGift')} accent="amber" onClick={() => setSendGiftOpen(true)} />
            <QuickTile icon={UserPlus} label={t('referralProgram')} accent="emerald" onClick={copyReferral} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={TrendingUp} label={t('lifetimeEarned')} value={`${data.lifetimeEarned.toFixed(2)} ₴`} />
            <StatCard icon={UserPlus} label={t('invitedFriends')} value={String(data.invitedCount)} />
          </div>

          {/* Savings goals — multi */}
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
              {!goalFormOpen && (
                <Button size="sm" variant="ghost" onClick={() => setGoalFormOpen(true)}>
                  <Plus className="size-4" />
                </Button>
              )}
            </div>

            {goalFormOpen && (
              <div className="mt-5 space-y-3 rounded-2xl border border-dashed p-4">
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
                  <Button onClick={addGoal} size="sm">{t('goalSave')}</Button>
                  <Button
                    onClick={() => { setGoalFormOpen(false); setGoalDraft({ title: '', target: '' }); }}
                    size="sm"
                    variant="ghost"
                  >
                    {tc('cancel')}
                  </Button>
                </div>
              </div>
            )}

            {goals.length === 0 && !goalFormOpen && (
              <p className="mt-5 text-sm text-muted-foreground">{t('goalTitlePh')}</p>
            )}

            <ul className="mt-5 space-y-4">
              {goals.map((g) => {
                const pct = progressFor(g.target);
                const reached = pct >= 100;
                return (
                  <li key={g.id} className="rounded-2xl border bg-background/40 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate font-medium">{g.title}</p>
                      <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {Math.min(data.balance, g.target).toFixed(0)} / {g.target.toFixed(0)} ₴
                      </p>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500'}`}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${reached ? 'text-emerald-500' : 'text-primary'}`}>{pct}%</span>
                      <div className="flex items-center gap-3">
                        {reached && (
                          <button onClick={() => achieveGoal(g.id)} className="font-semibold text-emerald-500 hover:text-emerald-600">
                            {t('goalSave')} ✓
                          </button>
                        )}
                        <button onClick={() => removeGoal(g.id)} className="text-muted-foreground hover:text-foreground">
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {achievements.length > 0 && (
              <div className="mt-6 border-t pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t('lifetimeEarned')}
                </p>
                <ul className="mt-3 space-y-2">
                  {achievements.map((a) => (
                    <li key={a.id + a.achievedAt} className="flex items-center justify-between rounded-xl bg-emerald-500/5 px-3 py-2 text-xs">
                      <span className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">✓</span>
                        <span className="font-medium">{a.title}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {a.target.toFixed(0)} ₴ · {new Date(a.achievedAt).toLocaleDateString('ru')}
                      </span>
                    </li>
                  ))}
                </ul>
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

        <TabsContent value="family" className="mt-6 space-y-6">
          <div className="rounded-3xl border bg-gradient-to-br from-violet-500/8 via-card to-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
                  <Users className="size-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{t('familyBudgetTitle')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('familyBudgetDesc')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('familyPeriod90d')}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{familyTotal.toFixed(0)} ₴</p>
              </div>
            </div>
          </div>

          {familyBudget.length === 0 ? (
            <div className="rounded-3xl border bg-card p-12 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Users className="size-8" />
              </div>
              <p className="mt-5 text-base font-semibold">{t('familyNoData')}</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {familyBudget.map((row, i) => (
                <li
                  key={`${row.name}-${i}`}
                  className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]"
                >
                  <div className="absolute -right-6 -top-6 size-24 rounded-full bg-violet-500/5 blur-2xl" />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.name}</p>
                      <p className="text-[11px] capitalize text-muted-foreground">{row.relationship}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
                      {row.visits} {t('familyVisits')}
                    </span>
                  </div>
                  <div className="relative mt-4 flex items-baseline justify-between">
                    <span className="text-2xl font-bold tabular-nums">{row.total.toFixed(0)} ₴</span>
                    {row.last && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(row.last).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  {familyTotal > 0 && (
                    <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (row.total / familyTotal) * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
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

        <TabsContent value="giftCards" className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-3xl border bg-gradient-to-br from-amber-500/8 via-card to-card p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <Gift className="size-6" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{t('giftCardsTitle')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('giftCardsDesc')}</p>
              </div>
            </div>
            <Button onClick={() => setSendGiftOpen(true)}>
              <Send className="mr-1 size-4" /> {t('sendGift')}
            </Button>
          </div>

          {giftReceived.length === 0 && giftSent.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Gift className="size-8" />
              </div>
              <p className="mt-5 text-base font-semibold">{t('noGiftCards')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {giftReceived.length > 0 && (
                <div>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t('giftReceivedHeader')}
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {giftReceived.map((gc) => (
                      <GiftCardTile
                        key={gc.id}
                        gc={gc}
                        kind="received"
                        copied={copiedCode === gc.code}
                        onCopy={() => copyGiftCode(gc.code)}
                        redeemedLabel={t('giftRedeemed')}
                        activeLabel={t('giftActive')}
                        codeLabel={t('giftCodeLabel')}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {giftSent.length > 0 && (
                <div>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t('giftSentHeader')}
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {giftSent.map((gc) => (
                      <GiftCardTile
                        key={gc.id}
                        gc={gc}
                        kind="sent"
                        copied={copiedCode === gc.code}
                        onCopy={() => copyGiftCode(gc.code)}
                        redeemedLabel={t('giftRedeemed')}
                        activeLabel={t('giftActive')}
                        codeLabel={t('giftCodeLabel')}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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

      <AnimatePresence>
        {sendGiftOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => !giftBusy && setSendGiftOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                    <Gift className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t('sendGiftTitle')}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{t('sendGiftDesc')}</p>
                  </div>
                </div>
                <button onClick={() => setSendGiftOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                  <XIcon className="size-4" />
                </button>
              </div>
              <input
                value={giftTo}
                onChange={(e) => setGiftTo(e.target.value)}
                placeholder={t('giftRecipientPh')}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="number"
                inputMode="decimal"
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder={t('giftAmountPh')}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder={t('giftMessagePh')}
                rows={3}
                className="w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('transferAvailable')}: <span className="font-semibold text-foreground">{data.balance.toFixed(2)} ₴</span>
              </p>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" disabled={giftBusy} onClick={() => setSendGiftOpen(false)}>
                  {tc('cancel')}
                </Button>
                <Button className="flex-1" disabled={giftBusy} onClick={submitSendGift}>
                  {giftBusy ? '…' : t('giftSendBtn')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GiftCardTile({
  gc,
  kind,
  copied,
  onCopy,
  redeemedLabel,
  activeLabel,
  codeLabel,
}: {
  gc: GiftCardRow;
  kind: 'sent' | 'received';
  copied: boolean;
  onCopy: () => void;
  redeemedLabel: string;
  activeLabel: string;
  codeLabel: string;
}) {
  const gradient =
    kind === 'received'
      ? 'from-amber-500/20 via-rose-500/15 to-fuchsia-500/20'
      : 'from-violet-500/20 via-indigo-500/15 to-sky-500/20';
  return (
    <li className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-xl bg-background/70 backdrop-blur ring-1 ring-border/60">
          <Gift className="size-5" />
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            gc.is_redeemed
              ? 'bg-muted text-muted-foreground'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
          }`}
        >
          {gc.is_redeemed ? redeemedLabel : activeLabel}
        </span>
      </div>
      <p className="relative mt-4 text-3xl font-bold tabular-nums">
        {gc.amount.toFixed(0)} <span className="text-base font-medium text-muted-foreground">{gc.currency}</span>
      </p>
      {gc.sender_message && (
        <p className="relative mt-2 line-clamp-2 text-xs italic text-muted-foreground">&ldquo;{gc.sender_message}&rdquo;</p>
      )}
      <div className="relative mt-4 flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-background/70 px-3 py-1.5 font-mono text-[11px] backdrop-blur">
          <span className="mr-1 text-[9px] uppercase text-muted-foreground">{codeLabel}</span>
          {gc.code}
        </div>
        <button
          onClick={onCopy}
          className="flex size-8 items-center justify-center rounded-lg bg-background/70 text-muted-foreground backdrop-blur hover:text-foreground"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </li>
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
