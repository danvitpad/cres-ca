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
  '/integrations': { feature: 'ai_features', requiredTier: 'business', label: 'Integrations' },

  // blacklist/loyalty/cadence became filter chips on /clients and sections in /clients/[id]
  '/clients/segments': { feature: 'extended_analytics', requiredTier: 'pro', label: 'Client segments' },

  '/services/memberships': { feature: 'gift_certificates', requiredTier: 'pro', label: 'Memberships' },

  '/finance/gift-cards': { feature: 'gift_certificates', requiredTier: 'pro', label: 'Gift cards' },
  '/finance/memberships': { feature: 'gift_certificates', requiredTier: 'pro', label: 'Memberships' },
  '/finance?tab=reports': { feature: 'extended_analytics', requiredTier: 'pro', label: 'Reports' },
  '/finance?tab=services': { feature: 'extended_analytics', requiredTier: 'pro', label: 'Services profitability' },

  '/marketing?tab=campaigns':  { feature: 'auto_messages', requiredTier: 'pro', label: 'Кампании' },
  '/marketing?tab=automation': { feature: 'auto_messages', requiredTier: 'pro', label: 'Автоматика' },
  '/marketing?tab=deals':      { feature: 'auto_upsell', requiredTier: 'pro', label: 'Промокоды' },
  '/marketing?tab=reviews':    { feature: 'auto_review_request', requiredTier: 'pro', label: 'Отзывы' },
  '/marketing?tab=referrals':  { feature: 'referral', requiredTier: 'pro', label: 'Реферальная программа' },

  '/settings/equipment': { feature: 'equipment_booking', requiredTier: 'business', label: 'Оборудование' },

  // Step 13: команда — только Business-уровень
  '/salon': { feature: 'team_management', requiredTier: 'business', label: 'Команда' },
  '/partners': { feature: 'cross_marketing', requiredTier: 'business', label: 'Партнёры' },
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
