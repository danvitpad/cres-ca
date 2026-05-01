/* --- YAML
   name: Subscription Plans — Release Pricing
   description: Renames "Free" → "START", "Business" → "MAX"; updates MAX price
     to 1499 UAH (was 1999); rewrites features array to match the tiers shown
     on the landing page. Slug values stay (free/pro/business) — code keys off
     them.
   created: 2026-05-01
   --- */

UPDATE public.subscription_plans
SET
  name = jsonb_build_object('en', 'START', 'ru', 'START', 'uk', 'START'),
  features = '[
    "unlimited_clients",
    "unlimited_appointments",
    "calendar_full",
    "client_cards_with_history",
    "public_page_with_theme",
    "client_self_booking_24_7",
    "auto_reminders_24h_2h",
    "promos_bonuses_referrals",
    "client_mini_app"
  ]'::jsonb,
  price_monthly = 299,
  price_yearly  = 2990
WHERE slug = 'free';

UPDATE public.subscription_plans
SET
  name = jsonb_build_object('en', 'PRO', 'ru', 'PRO', 'uk', 'PRO'),
  features = '[
    "everything_in_start",
    "voice_input_telegram",
    "ai_assistant_for_clients",
    "segmented_broadcasts",
    "smart_rebooking",
    "supplier_orders_pdf",
    "lost_revenue_insights",
    "find_marketplace_listing"
  ]'::jsonb,
  price_monthly = 799,
  price_yearly  = 7990
WHERE slug = 'pro';

UPDATE public.subscription_plans
SET
  name = jsonb_build_object('en', 'MAX', 'ru', 'MAX', 'uk', 'MAX'),
  features = '[
    "everything_in_pro",
    "ai_client_behavior_analysis",
    "pnl_ltv_retention_reports",
    "find_priority_placement",
    "branded_broadcasts",
    "priority_support"
  ]'::jsonb,
  price_monthly = 1499,
  price_yearly  = 14990
WHERE slug = 'business';
