/** --- YAML
 * name: Core Types
 * description: Shared TypeScript types for the entire CRES-CA application
 * --- */

// ============ User Roles ============

export type UserRole = 'client' | 'master' | 'salon_admin' | 'receptionist';

// ============ Subscription ============

export type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'business';

export interface SubscriptionLimits {
  maxClients: number; // -1 = unlimited
  maxMasters: number; // -1 = unlimited
  features: SubscriptionFeature[];
}

export type SubscriptionFeature =
  | 'calendar'
  | 'online_booking'
  | 'basic_client_cards'
  | 'reminders'
  | 'basic_finance'
  | 'waitlist'
  | 'auto_upsell'
  | 'referral'
  | 'inventory'
  | 'consent_forms'
  | 'allergies'
  | 'extended_analytics'
  | 'auto_messages'
  | 'ai_features'
  | 'behavior_indicators'
  | 'file_storage'
  | 'equipment_booking'
  | 'cross_marketing'
  | 'auto_reports'
  | 'currency_tracking'
  | 'before_after'
  | 'gift_certificates'
  | 'priority_support';

export const SUBSCRIPTION_CONFIG: Record<SubscriptionTier, SubscriptionLimits> = {
  trial: {
    maxClients: -1,
    maxMasters: -1,
    features: [
      'calendar', 'online_booking', 'basic_client_cards', 'reminders',
      'basic_finance', 'waitlist', 'auto_upsell', 'referral', 'inventory',
      'consent_forms', 'allergies', 'extended_analytics', 'auto_messages',
      'ai_features', 'behavior_indicators', 'file_storage', 'equipment_booking',
      'cross_marketing', 'auto_reports', 'currency_tracking', 'before_after',
      'gift_certificates', 'priority_support',
    ],
  },
  starter: {
    maxClients: 50,
    maxMasters: 1,
    features: [
      'calendar', 'online_booking', 'basic_client_cards', 'reminders',
      'basic_finance',
    ],
  },
  pro: {
    maxClients: 300,
    maxMasters: 3,
    features: [
      'calendar', 'online_booking', 'basic_client_cards', 'reminders',
      'basic_finance', 'waitlist', 'auto_upsell', 'referral', 'inventory',
      'consent_forms', 'allergies', 'extended_analytics', 'auto_messages',
    ],
  },
  business: {
    maxClients: -1,
    maxMasters: -1,
    features: [
      'calendar', 'online_booking', 'basic_client_cards', 'reminders',
      'basic_finance', 'waitlist', 'auto_upsell', 'referral', 'inventory',
      'consent_forms', 'allergies', 'extended_analytics', 'auto_messages',
      'ai_features', 'behavior_indicators', 'file_storage', 'equipment_booking',
      'cross_marketing', 'auto_reports', 'currency_tracking', 'before_after',
      'gift_certificates', 'priority_support',
    ],
  },
};

// ============ Appointment ============

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

// ============ Client Behavior Indicators ============

export type BehaviorIndicator =
  | 'frequent_canceller'  // Cancels often
  | 'often_late'          // Often arrives late
  | 'rude'                // Rude behavior reported
  | 'excellent';          // Great client

// ============ Helpers ============

export function hasFeature(tier: SubscriptionTier, feature: SubscriptionFeature): boolean {
  return SUBSCRIPTION_CONFIG[tier].features.includes(feature);
}

export function isWithinClientLimit(tier: SubscriptionTier, currentCount: number): boolean {
  const limit = SUBSCRIPTION_CONFIG[tier].maxClients;
  return limit === -1 || currentCount < limit;
}

export function isWithinMasterLimit(tier: SubscriptionTier, currentCount: number): boolean {
  const limit = SUBSCRIPTION_CONFIG[tier].maxMasters;
  return limit === -1 || currentCount < limit;
}
