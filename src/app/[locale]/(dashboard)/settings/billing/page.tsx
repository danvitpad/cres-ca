/** --- YAML
 * name: Billing Page
 * description: Страница подписки и биллинга мастера. Текущий план, trial countdown, матрица тарифов, кнопка Upgrade на LiqPay, история платежей, отмена подписки.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, Sparkles, Clock, AlertTriangle, Infinity as InfinityIcon, Receipt, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { SUBSCRIPTION_CONFIG, type SubscriptionTier } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type SubStatus = 'active' | 'trial' | 'past_due' | 'expired' | 'cancelled';
interface SubInfo {
  tier: SubscriptionTier;
  status: SubStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  provider: string | null;
  invoice_url: string | null;
  created_at: string;
}

const PLAN_ORDER: SubscriptionTier[] = ['starter', 'pro', 'business'];

const PLAN_PRICES: Record<SubscriptionTier, { monthly: number; currency: string }> = {
  trial: { monthly: 0, currency: 'UAH' },
  starter: { monthly: 299, currency: 'UAH' },
  pro: { monthly: 799, currency: 'UAH' },
  business: { monthly: 1999, currency: 'UAH' },
};

export default function BillingPage() {
  const t = useTranslations('billing');
  const tCommon = useTranslations('common');
  const { userId } = useAuthStore();
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<SubscriptionTier | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      const [subRes, payRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('tier, status, trial_ends_at, current_period_end')
          .eq('profile_id', userId)
          .maybeSingle(),
        supabase
          .from('payment_history')
          .select('id, amount, currency, status, provider, invoice_url, created_at')
          .eq('profile_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (subRes.data) setSub(subRes.data as SubInfo);
      if (payRes.data) setPayments(payRes.data as PaymentRow[]);
      setLoading(false);
    })();
  }, [userId]);

  const trialDaysLeft = useMemo(() => {
    if (!sub?.trial_ends_at) return null;
    const ms = new Date(sub.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [sub]);

  const currentTier = sub?.tier ?? 'trial';
  const currentLimits = SUBSCRIPTION_CONFIG[currentTier];

  async function handleUpgrade(tier: SubscriptionTier) {
    try {
      setUpgrading(tier);
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          tier,
          amount: PLAN_PRICES[tier].monthly,
          currency: PLAN_PRICES[tier].currency,
        }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      const { data, signature } = await res.json();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://www.liqpay.ua/api/3/checkout';
      form.acceptCharset = 'utf-8';
      form.target = '_blank';
      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'data';
      dataInput.value = data;
      const sigInput = document.createElement('input');
      sigInput.type = 'hidden';
      sigInput.name = 'signature';
      sigInput.value = signature;
      form.appendChild(dataInput);
      form.appendChild(sigInput);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch {
      toast.error(t('upgradeError'));
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancelSubscription() {
    try {
      setCancelling(true);
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || null }),
      });
      if (!res.ok) throw new Error('cancel_failed');
      toast.success(t('cancelSuccess'));
      setShowCancelModal(false);
      setCancelReason('');
      setSub((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
    } catch {
      toast.error(t('cancelError'));
    } finally {
      setCancelling(false);
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t('backToSettings')}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('currentPlan')}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-bold capitalize">{currentTier}</span>
                {sub?.status && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      sub.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : sub.status === 'trial'
                          ? 'bg-primary/10 text-primary'
                          : sub.status === 'past_due'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {t(`status.${sub.status}`)}
                  </span>
                )}
              </div>
              {currentTier === 'trial' && trialDaysLeft !== null && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5" />
                  {t('trialDaysLeft', { days: trialDaysLeft })}
                </div>
              )}
              {sub?.status === 'past_due' && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-amber-600">
                  <AlertTriangle className="size-3.5" />
                  {t('pastDueWarning')}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{t('limits')}</div>
              <div className="mt-1 text-sm">
                <span className="font-medium">
                  {currentLimits.maxClients === -1 ? '∞' : currentLimits.maxClients}
                </span>{' '}
                {t('clients')}
              </div>
              <div className="text-sm">
                <span className="font-medium">
                  {currentLimits.maxMasters === -1 ? '∞' : currentLimits.maxMasters}
                </span>{' '}
                {t('masters')}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold">{t('choosePlan')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((tier, idx) => {
            const limits = SUBSCRIPTION_CONFIG[tier];
            const price = PLAN_PRICES[tier];
            const isCurrent = tier === currentTier;
            const isRecommended = tier === 'pro';
            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  isRecommended
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    {t('recommended')}
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    {tier}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{price.monthly}</span>
                    <span className="text-sm text-muted-foreground">
                      {price.currency}/{t('perMonth')}
                    </span>
                  </div>
                </div>

                <ul className="mb-6 flex-1 space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      {limits.maxClients === -1 ? (
                        <InfinityIcon className="inline size-3" />
                      ) : (
                        limits.maxClients
                      )}{' '}
                      {t('clients')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      {limits.maxMasters === -1 ? (
                        <InfinityIcon className="inline size-3" />
                      ) : (
                        limits.maxMasters
                      )}{' '}
                      {t('masters')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      {limits.features.length} {t('featuresCount')}
                    </span>
                  </li>
                  {tier === 'pro' && (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{t('proHighlight1')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{t('proHighlight2')}</span>
                      </li>
                    </>
                  )}
                  {tier === 'business' && (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{t('businessHighlight1')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{t('businessHighlight2')}</span>
                      </li>
                    </>
                  )}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-full border border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    {t('currentLabel')}
                  </button>
                ) : (
                  <button
                    disabled={upgrading === tier}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 ${
                      isRecommended
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground text-background'
                    }`}
                    onClick={() => handleUpgrade(tier)}
                  >
                    <Sparkles className="size-4" />
                    {upgrading === tier ? t('upgrading') : t('upgradeTo', { tier })}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Receipt className="size-5" />
          {t('historyTitle')}
        </h2>
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {t('historyEmpty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t('historyDate')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('historyAmount')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('historyStatus')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('historyProvider')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('historyInvoice')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      {p.amount} {p.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'succeeded'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : p.status === 'pending'
                              ? 'bg-primary/10 text-primary'
                              : p.status === 'refunded'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {t(`historyStatusValue.${p.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.provider ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t('historyInvoiceOpen')}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sub?.status === 'active' && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-destructive">
                <XCircle className="size-4" />
                {t('cancelTitle')}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('cancelDescription')}</p>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <XCircle className="size-4" />
              {t('cancelButton')}
            </button>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold">{t('cancelConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t('cancelConfirmDescription')}</p>
            <label className="mt-4 block text-sm font-medium">{t('cancelReasonLabel')}</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('cancelReasonPlaceholder')}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={cancelling}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {cancelling ? t('cancelling') : t('cancelConfirmButton')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground">
        {t('support')}{' '}
        <a href="mailto:support@cres.app" className="text-primary hover:underline">
          support@cres.app
        </a>
      </div>
    </div>
  );
}
