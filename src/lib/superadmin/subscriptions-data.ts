/** --- YAML
 * name: Superadmin subscriptions data
 * description: Buckets subscriptions into active/trial/whitelist/cancelled with MRR and trial-deadline info for /superadmin/subscriptions.
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface SubRow {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  tier: string;
  status: string;
  billingPeriod: string | null;
  createdAt: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  mrrContribution: number;
  daysLeft: number | null;
}

export interface WhitelistRow {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  grantedPlan: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface SubsBuckets {
  active: SubRow[];
  trial: SubRow[];
  whitelist: WhitelistRow[];
  cancelled: SubRow[];
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

function displayName(p: { full_name: string | null; first_name: string | null } | null) {
  return p?.full_name || p?.first_name || 'Без имени';
}

function mrrFor(tier: string, billing: string | null, plan: { price_monthly: number | null; price_yearly: number | null } | null): number {
  if (!plan || tier === 'trial') return 0;
  const monthly = Number(plan.price_monthly ?? 0);
  const yearly = Number(plan.price_yearly ?? 0);
  return billing === 'yearly' && yearly > 0 ? Math.round(yearly / 12) : monthly;
}

export async function getSubscriptionsBuckets(): Promise<SubsBuckets> {
  const db = admin();

  const [activeRes, trialRes, cancelledRes, whitelistRes] = await Promise.all([
    db
      .from('subscriptions')
      .select('id, profile_id, tier, status, billing_period, created_at, trial_ends_at, current_period_end, cancelled_at, cancel_reason, subscription_plans:plan_id(price_monthly, price_yearly), profiles:profile_id(full_name, first_name, email)')
      .eq('status', 'active')
      .neq('tier', 'trial')
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('subscriptions')
      .select('id, profile_id, tier, status, billing_period, created_at, trial_ends_at, current_period_end, cancelled_at, cancel_reason, subscription_plans:plan_id(price_monthly, price_yearly), profiles:profile_id(full_name, first_name, email)')
      .eq('tier', 'trial')
      .order('trial_ends_at', { ascending: true })
      .limit(200),
    db
      .from('subscriptions')
      .select('id, profile_id, tier, status, billing_period, created_at, trial_ends_at, current_period_end, cancelled_at, cancel_reason, subscription_plans:plan_id(price_monthly, price_yearly), profiles:profile_id(full_name, first_name, email)')
      .eq('status', 'cancelled')
      .order('cancelled_at', { ascending: false })
      .limit(200),
    db
      .from('platform_whitelist')
      .select('id, profile_id, granted_plan, reason, created_at, expires_at, profiles:profile_id(full_name, first_name, email)')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  type SubQuery = {
    id: string;
    profile_id: string;
    tier: string;
    status: string;
    billing_period: string | null;
    created_at: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    subscription_plans: { price_monthly: number | null; price_yearly: number | null } | { price_monthly: number | null; price_yearly: number | null }[] | null;
    profiles: { full_name: string | null; first_name: string | null; email: string | null } | { full_name: string | null; first_name: string | null; email: string | null }[] | null;
  };

  const mapSub = (r: SubQuery): SubRow => {
    const plan = Array.isArray(r.subscription_plans) ? r.subscription_plans[0] : r.subscription_plans;
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      profileId: r.profile_id,
      profileName: displayName(prof),
      profileEmail: prof?.email ?? null,
      tier: r.tier,
      status: r.status,
      billingPeriod: r.billing_period,
      createdAt: r.created_at,
      trialEndsAt: r.trial_ends_at,
      currentPeriodEnd: r.current_period_end,
      cancelledAt: r.cancelled_at,
      cancelReason: r.cancel_reason,
      mrrContribution: mrrFor(r.tier, r.billing_period, plan),
      daysLeft: daysLeft(r.trial_ends_at ?? r.current_period_end ?? null),
    };
  };

  type WlQuery = {
    id: string;
    profile_id: string;
    granted_plan: string;
    reason: string | null;
    created_at: string;
    expires_at: string | null;
    profiles: { full_name: string | null; first_name: string | null; email: string | null } | { full_name: string | null; first_name: string | null; email: string | null }[] | null;
  };

  const active: SubRow[] = ((activeRes.data ?? []) as unknown as SubQuery[]).map(mapSub);
  const trial: SubRow[] = ((trialRes.data ?? []) as unknown as SubQuery[]).map(mapSub);
  const cancelled: SubRow[] = ((cancelledRes.data ?? []) as unknown as SubQuery[]).map(mapSub);
  const whitelist: WhitelistRow[] = ((whitelistRes.data ?? []) as unknown as WlQuery[]).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      profileId: r.profile_id,
      profileName: displayName(prof),
      profileEmail: prof?.email ?? null,
      grantedPlan: r.granted_plan,
      reason: r.reason,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    };
  });

  return { active, trial, cancelled, whitelist };
}
