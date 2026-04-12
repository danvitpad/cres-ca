/** --- YAML
 * name: ClientWalletPage
 * description: Client wallet — balance, bonus points, referral program, gift cards, saved payment methods
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, Check, Gift, CreditCard, Plus, Sparkles, UserPlus, TrendingUp } from 'lucide-react';
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

export default function WalletPage() {
  const t = useTranslations('clientWallet');
  const { userId } = useAuthStore();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
      setLoading(false);
    }
    load();
  }, [userId]);

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
        <TabsList className="grid w-full grid-cols-4 max-w-[560px]">
          <TabsTrigger value="balance">{t('tab_balance')}</TabsTrigger>
          <TabsTrigger value="referrals">{t('tab_referrals')}</TabsTrigger>
          <TabsTrigger value="giftCards">{t('tab_giftCards')}</TabsTrigger>
          <TabsTrigger value="cards">{t('tab_cards')}</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-6 space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500 p-8 text-white shadow-xl">
            <div className="absolute -right-16 -top-16 size-60 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 size-60 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">{t('balance')}</p>
                <p className="mt-2 text-5xl font-bold tracking-tight">{data.balance.toFixed(2)} ₴</p>
                <p className="mt-3 text-sm text-white/80">
                  {t('bonusPoints')}: <span className="font-semibold text-white">{data.bonusPoints}</span>
                </p>
              </div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Sparkles className="size-7" />
              </div>
            </div>
            <div className="relative mt-6 flex gap-3">
              <Button variant="secondary" className="bg-white text-foreground hover:bg-white/90">
                <Plus className="mr-1 size-4" /> {t('topUp')}
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/15">
                {t('transfer')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={TrendingUp} label={t('lifetimeEarned')} value={`${data.lifetimeEarned.toFixed(2)} ₴`} />
            <StatCard icon={UserPlus} label={t('invitedFriends')} value={String(data.invitedCount)} />
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
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
