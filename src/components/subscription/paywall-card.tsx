/** --- YAML
 * name: PaywallCard
 * description: Универсальная карточка-заглушка для фичи, недоступной на текущем тарифе. Показывает что фича разблокируется на `requiredTier` + CTA-кнопка «Upgrade». Используется в `<WithFeature>`.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SubscriptionTier } from '@/types';

interface Props {
  feature: string;
  requiredTier: SubscriptionTier;
  title?: string;
  description?: string;
}

export function PaywallCard({ feature, requiredTier, title, description }: Props) {
  const t = useTranslations('subscription.paywall');
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-6" />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-lg font-semibold">{title ?? t('title')}</h3>
        <p className="text-sm text-muted-foreground">
          {description ?? t('description', { feature, tier: requiredTier.toUpperCase() })}
        </p>
      </div>
      <Link
        href="/settings/billing"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Sparkles className="size-4" />
        {t('upgrade')}
      </Link>
    </div>
  );
}
