/** --- YAML
 * name: Superadmin settings data
 * description: getPlatformSettings() — subscription_plans + referral counters + env statuses (Hutko, TG bot, SUPERADMIN_EMAILS) to render on /superadmin/settings.
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSuperadminEmails } from '@/lib/superadmin/access';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface PlanRow {
  id: string;
  slug: string;
  tier: string;
  nameRu: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  limits: Record<string, number>;
  sortOrder: number;
  updatedAt: string | null;
}

export interface IntegrationStatus {
  name: string;
  connected: boolean;
  detail: string;
}

export interface PlatformSettings {
  plans: PlanRow[];
  trialDays: number;
  referralClientBonus: number;
  referralMasterPercent: number;
  superadminEmails: string[];
  integrations: IntegrationStatus[];
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const db = admin();

  const { data: planData } = await db
    .from('subscription_plans')
    .select('id, slug, tier, name, price_monthly, price_yearly, currency, features, limits, sort_order, updated_at')
    .order('sort_order', { ascending: true });

  type RawPlan = {
    id: string;
    slug: string;
    tier: string;
    name: unknown;
    price_monthly: number;
    price_yearly: number;
    currency: string;
    features: unknown;
    limits: unknown;
    sort_order: number;
    updated_at: string | null;
  };

  const plans: PlanRow[] = ((planData ?? []) as RawPlan[]).map((p) => {
    const nameObj = (p.name && typeof p.name === 'object' && !Array.isArray(p.name)) ? (p.name as Record<string, string>) : {};
    return {
      id: p.id,
      slug: p.slug,
      tier: p.tier,
      nameRu: nameObj.ru ?? p.slug,
      priceMonthly: Number(p.price_monthly ?? 0),
      priceYearly: Number(p.price_yearly ?? 0),
      currency: p.currency ?? 'UAH',
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
      limits: (p.limits && typeof p.limits === 'object' && !Array.isArray(p.limits)) ? (p.limits as Record<string, number>) : {},
      sortOrder: p.sort_order,
      updatedAt: p.updated_at,
    };
  });

  const trialDays = Number(process.env.TRIAL_DAYS ?? 14);

  const integrations: IntegrationStatus[] = [
    {
      name: 'Hutko Pay',
      connected: !!process.env.HUTKO_API_KEY,
      detail: process.env.HUTKO_API_KEY ? 'API ключ настроен' : 'HUTKO_API_KEY не задан в .env',
    },
    {
      name: 'LiqPay',
      connected: !!process.env.LIQPAY_PUBLIC_KEY && !!process.env.LIQPAY_PRIVATE_KEY,
      detail: process.env.LIQPAY_PUBLIC_KEY ? 'Ключи настроены' : 'LIQPAY_PUBLIC_KEY / LIQPAY_PRIVATE_KEY не заданы',
    },
    {
      name: 'Telegram Bot',
      connected: !!process.env.TELEGRAM_BOT_TOKEN,
      detail: process.env.TELEGRAM_BOT_TOKEN
        ? `Webhook: ${process.env.TELEGRAM_WEBHOOK_URL ?? '—'}`
        : 'TELEGRAM_BOT_TOKEN не задан',
    },
    {
      name: 'OpenAI (Voice AI)',
      connected: !!process.env.OPENAI_API_KEY,
      detail: process.env.OPENAI_API_KEY ? 'API ключ настроен' : 'OPENAI_API_KEY не задан',
    },
    {
      name: 'Feedback TG канал',
      connected: !!process.env.FEEDBACK_TG_CHANNEL_ID,
      detail: process.env.FEEDBACK_TG_CHANNEL_ID ? `Канал: ${process.env.FEEDBACK_TG_CHANNEL_ID}` : 'FEEDBACK_TG_CHANNEL_ID не задан',
    },
  ];

  return {
    plans,
    trialDays,
    referralClientBonus: Number(process.env.REFERRAL_CLIENT_BONUS ?? 50),
    referralMasterPercent: Number(process.env.REFERRAL_MASTER_PERCENT ?? 10),
    superadminEmails: getSuperadminEmails(),
    integrations,
  };
}
