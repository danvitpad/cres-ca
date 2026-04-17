/** --- YAML
 * name: Route Feature Map
 * description: Карта dashboard-роутов → требуемая SubscriptionFeature + минимальный тариф. Используется `<RouteFeatureGate>` чтобы показывать paywall на страницах выше текущего тарифа.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import type { SubscriptionFeature, SubscriptionTier } from '@/types';

export interface RouteFeatureRule {
  feature: SubscriptionFeature;
  requiredTier: SubscriptionTier;
  label: string;
}

/**
 * Проверяется по longest-prefix match. Роуты не в карте — считаются free (доступны всем).
 */
export const ROUTE_FEATURES: Record<string, RouteFeatureRule> = {
  '/inventory': { feature: 'inventory', requiredTier: 'pro', label: 'Inventory' },
  '/before-after': { feature: 'before_after', requiredTier: 'pro', label: 'Before/After' },
  // '/consents' merged into client detail page
  '/recommend': { feature: 'auto_upsell', requiredTier: 'pro', label: 'Recommendations' },
  '/queue': { feature: 'waitlist', requiredTier: 'pro', label: 'Waitlist' },
  // '/voice-notes' merged into client detail page notes section
  '/network': { feature: 'guild_marketing', requiredTier: 'business', label: 'Network marketing' },
  '/addons': { feature: 'ai_features', requiredTier: 'business', label: 'AI add-ons' },

  // blacklist/loyalty/cadence became filter chips on /clients and sections in /clients/[id]
  '/clients/segments': { feature: 'extended_analytics', requiredTier: 'pro', label: 'Client segments' },

  '/services/memberships': { feature: 'gift_certificates', requiredTier: 'pro', label: 'Memberships' },

  '/finance/gift-cards': { feature: 'gift_certificates', requiredTier: 'pro', label: 'Gift cards' },
  '/finance/memberships': { feature: 'gift_certificates', requiredTier: 'pro', label: 'Memberships' },
  '/finance?tab=reports': { feature: 'extended_analytics', requiredTier: 'pro', label: 'Reports' },
  '/finance?tab=services': { feature: 'extended_analytics', requiredTier: 'pro', label: 'Services profitability' },

  '/marketing/campaigns': { feature: 'auto_messages', requiredTier: 'pro', label: 'Campaigns' },
  '/marketing/automation': { feature: 'auto_messages', requiredTier: 'pro', label: 'Automation' },
  '/marketing/messages': { feature: 'auto_messages', requiredTier: 'pro', label: 'Messaging' },
  '/marketing/deals': { feature: 'auto_upsell', requiredTier: 'pro', label: 'Deals' },
  '/marketing/pricing': { feature: 'burning_slots', requiredTier: 'pro', label: 'Smart pricing' },
  '/marketing/reviews': { feature: 'auto_review_request', requiredTier: 'pro', label: 'Reviews' },
  '/marketing/google': { feature: 'google_business', requiredTier: 'business', label: 'Google Business' },
  '/marketing/social': { feature: 'social_posting', requiredTier: 'business', label: 'Social posting' },

  '/settings/equipment': { feature: 'equipment_booking', requiredTier: 'business', label: 'Equipment booking' },
};

/**
 * Находит правило для текущего pathname (longest-prefix match, локаль-независимо).
 * Ожидает pathname БЕЗ префикса локали (/ru, /uk, /en).
 */
export function getRouteFeatureRule(pathname: string): RouteFeatureRule | null {
  const stripped = pathname.replace(/^\/(ru|uk|en)(?=\/|$)/, '') || '/';
  let best: RouteFeatureRule | null = null;
  let bestLen = 0;
  for (const [prefix, rule] of Object.entries(ROUTE_FEATURES)) {
    if ((stripped === prefix || stripped.startsWith(prefix + '/')) && prefix.length > bestLen) {
      best = rule;
      bestLen = prefix.length;
    }
  }
  return best;
}
