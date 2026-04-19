/** --- YAML
 * name: Subscription Feature Access
 * description: Phase 3 — server-side helper to check whether a profile has access to a given feature or stays within a resource limit based on their current subscription tier. Backed by SUBSCRIPTION_CONFIG + live subscriptions row (trial_ends_at, status).
 * created: 2026-04-19
 * --- */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { SUBSCRIPTION_CONFIG, type SubscriptionTier, type SubscriptionFeature } from '@/types';
import { getWhitelistEntry } from '@/lib/superadmin/access';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface AccessResult {
  allowed: boolean;
  tier: SubscriptionTier;
  reason?: 'not_subscribed' | 'past_due' | 'expired' | 'trial_ended' | 'feature_gated' | 'limit_reached';
}

async function effectiveTier(profileId: string): Promise<{ tier: SubscriptionTier; status: 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial'; subscription_id?: string } | null> {
  const { data } = await admin()
    .from('subscriptions')
    .select('id, tier, status, trial_ends_at, current_period_end')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const now = Date.now();
  const trialExpired = data.trial_ends_at && new Date(data.trial_ends_at).getTime() < now;
  const periodExpired = data.current_period_end && new Date(data.current_period_end).getTime() < now;

  if (data.tier === 'trial' && trialExpired) {
    return { tier: 'starter', status: 'expired', subscription_id: data.id };
  }
  if (data.status === 'past_due' || data.status === 'expired') {
    return { tier: 'starter', status: data.status, subscription_id: data.id };
  }
  if (periodExpired && data.status === 'active') {
    return { tier: 'starter', status: 'expired', subscription_id: data.id };
  }

  return { tier: data.tier as SubscriptionTier, status: data.tier === 'trial' ? 'trial' : (data.status as 'active' | 'cancelled'), subscription_id: data.id };
}

export async function checkFeatureAccess(profileId: string, feature: SubscriptionFeature): Promise<AccessResult> {
  const wl = await getWhitelistEntry(profileId);
  if (wl) {
    const hasFeature = SUBSCRIPTION_CONFIG[wl.granted_plan].features.includes(feature);
    if (!hasFeature) return { allowed: false, tier: wl.granted_plan, reason: 'feature_gated' };
    return { allowed: true, tier: wl.granted_plan };
  }

  const eff = await effectiveTier(profileId);
  if (!eff) return { allowed: false, tier: 'starter', reason: 'not_subscribed' };

  const hasFeature = SUBSCRIPTION_CONFIG[eff.tier].features.includes(feature);
  if (!hasFeature) return { allowed: false, tier: eff.tier, reason: 'feature_gated' };

  return { allowed: true, tier: eff.tier };
}

export async function checkClientLimit(profileId: string, currentCount: number): Promise<AccessResult> {
  const wl = await getWhitelistEntry(profileId);
  if (wl) {
    const limit = SUBSCRIPTION_CONFIG[wl.granted_plan].maxClients;
    if (limit !== -1 && currentCount >= limit) {
      return { allowed: false, tier: wl.granted_plan, reason: 'limit_reached' };
    }
    return { allowed: true, tier: wl.granted_plan };
  }

  const eff = await effectiveTier(profileId);
  if (!eff) return { allowed: false, tier: 'starter', reason: 'not_subscribed' };

  const limit = SUBSCRIPTION_CONFIG[eff.tier].maxClients;
  if (limit !== -1 && currentCount >= limit) {
    return { allowed: false, tier: eff.tier, reason: 'limit_reached' };
  }
  return { allowed: true, tier: eff.tier };
}

export async function checkMasterLimit(profileId: string, currentCount: number): Promise<AccessResult> {
  const wl = await getWhitelistEntry(profileId);
  if (wl) {
    const limit = SUBSCRIPTION_CONFIG[wl.granted_plan].maxMasters;
    if (limit !== -1 && currentCount >= limit) {
      return { allowed: false, tier: wl.granted_plan, reason: 'limit_reached' };
    }
    return { allowed: true, tier: wl.granted_plan };
  }

  const eff = await effectiveTier(profileId);
  if (!eff) return { allowed: false, tier: 'starter', reason: 'not_subscribed' };

  const limit = SUBSCRIPTION_CONFIG[eff.tier].maxMasters;
  if (limit !== -1 && currentCount >= limit) {
    return { allowed: false, tier: eff.tier, reason: 'limit_reached' };
  }
  return { allowed: true, tier: eff.tier };
}

export async function getEffectiveTier(profileId: string): Promise<SubscriptionTier> {
  const wl = await getWhitelistEntry(profileId);
  if (wl) return wl.granted_plan;
  const eff = await effectiveTier(profileId);
  return eff?.tier ?? 'starter';
}
