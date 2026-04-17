/** --- YAML
 * name: FeatureFlagsPerVertical
 * description: Which dashboard modules are enabled by default per vertical. Master can override in settings via profile.feature_overrides.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import type { VerticalKey } from './default-services';

export interface VerticalFeatures {
  /** Client card: medical/health profile section */
  healthProfile: boolean;
  /** Client card: before/after photos gallery */
  gallery: boolean;
  /** Client card: family links (parent/child/spouse) */
  familyLinks: boolean;
  /** Catalogue: memberships (N visits for price) */
  memberships: boolean;
  /** Catalogue: gift cards */
  giftCards: boolean;
  /** Inventory / materials tracking */
  inventory: boolean;
  /** Loyalty punch card */
  loyalty: boolean;
  /** Smart rebooking reminders (cadence) */
  smartRebooking: boolean;
  /** Mobile visits — visit client's location */
  mobileVisits: boolean;
  /** Online consultations (Zoom/Meet) */
  onlineConsults: boolean;
  /** Portfolio/stories for public page */
  portfolio: boolean;
  /** Reviews management */
  reviews: boolean;
  /** Telegram voice notes for master */
  voiceNotes: boolean;
}

/**
 * Default features per vertical.
 * Master can override any flag in settings; stored in profiles.feature_overrides JSONB.
 */
export const DEFAULT_FEATURES: Record<VerticalKey, VerticalFeatures> = {
  beauty: {
    healthProfile: true,
    gallery: true,
    familyLinks: true,
    memberships: true,
    giftCards: true,
    inventory: true,
    loyalty: true,
    smartRebooking: true,
    mobileVisits: false,
    onlineConsults: false,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  health: {
    // Dental, general medical, physiotherapy
    healthProfile: true,
    gallery: false,
    familyLinks: true,
    memberships: false,
    giftCards: false,
    inventory: true,
    loyalty: false,
    smartRebooking: true,
    mobileVisits: false,
    onlineConsults: true,
    portfolio: false,
    reviews: true,
    voiceNotes: true,
  },
  auto: {
    // Plumber, electrician, auto mechanic
    healthProfile: false,
    gallery: true, // before/after of the job
    familyLinks: false,
    memberships: false,
    giftCards: false,
    inventory: true, // parts
    loyalty: true, // frequent-customer discounts
    smartRebooking: false,
    mobileVisits: true,
    onlineConsults: false,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  tattoo: {
    healthProfile: true, // allergies, blood thinners
    gallery: true,
    familyLinks: false,
    memberships: false,
    giftCards: true,
    inventory: true, // ink, needles
    loyalty: true,
    smartRebooking: false,
    mobileVisits: false,
    onlineConsults: false,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  pets: {
    // Vet, groomer
    healthProfile: true, // medical history of pet
    gallery: true,
    familyLinks: false, // pets don't have family links
    memberships: true,
    giftCards: true,
    inventory: true,
    loyalty: true,
    smartRebooking: true,
    mobileVisits: true,
    onlineConsults: true,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  craft: {
    // Tailor, cobbler, watchmaker, key-maker
    healthProfile: false,
    gallery: true,
    familyLinks: false,
    memberships: false,
    giftCards: true,
    inventory: true, // materials
    loyalty: true,
    smartRebooking: false,
    mobileVisits: false,
    onlineConsults: false,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  fitness: {
    // Personal trainer, yoga instructor, pilates
    healthProfile: true, // injuries, limits
    gallery: true, // progress photos
    familyLinks: false,
    memberships: true, // recurring packages
    giftCards: true,
    inventory: false,
    loyalty: false,
    smartRebooking: true,
    mobileVisits: true,
    onlineConsults: true,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  events: {
    // Photographer, DJ, event planner, videographer
    healthProfile: false,
    gallery: true, // portfolio is the selling point
    familyLinks: false,
    memberships: false,
    giftCards: true,
    inventory: false,
    loyalty: false,
    smartRebooking: false,
    mobileVisits: true,
    onlineConsults: false,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
  education: {
    // Tutor, coach, therapist, psychologist
    healthProfile: false,
    gallery: false,
    familyLinks: true, // parent-child for tutors
    memberships: true, // recurring sessions
    giftCards: false,
    inventory: false,
    loyalty: false,
    smartRebooking: true,
    mobileVisits: false,
    onlineConsults: true,
    portfolio: false,
    reviews: true,
    voiceNotes: true,
  },
  other: {
    // Generic fallback — show everything, master disables unused
    healthProfile: false,
    gallery: true,
    familyLinks: false,
    memberships: true,
    giftCards: true,
    inventory: false,
    loyalty: true,
    smartRebooking: false,
    mobileVisits: false,
    onlineConsults: false,
    portfolio: true,
    reviews: true,
    voiceNotes: true,
  },
};

/**
 * Resolve final feature flags for a master.
 * @param vertical Master's vertical (or null → 'other' fallback)
 * @param overrides Per-master overrides from profiles.feature_overrides JSONB
 */
export function resolveFeatures(
  vertical: VerticalKey | null | undefined,
  overrides?: Partial<VerticalFeatures> | null,
): VerticalFeatures {
  const base = DEFAULT_FEATURES[vertical || 'other'] || DEFAULT_FEATURES.other;
  return { ...base, ...(overrides || {}) };
}
