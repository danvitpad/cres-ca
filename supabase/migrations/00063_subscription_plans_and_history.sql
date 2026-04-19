/** --- YAML
 * name: Subscription Plans + Payment History + Subscription Extensions
 * description: Phase 3 — formalise plan catalogue (subscription_plans), add payment_history log, extend existing subscriptions table with billing_period, cancel metadata, Hutko IDs. Preserves existing subscription_tier enum (trial/starter/pro/business).
 * created: 2026-04-19
 * --- */

-- 1. subscription_plans — plan catalogue (one row per tier, editable features/limits/names)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  tier subscription_tier NOT NULL,
  name jsonb NOT NULL,                -- {"ru":..., "en":..., "uk":...}
  description jsonb DEFAULT '{}'::jsonb,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric,
  currency text NOT NULL DEFAULT 'UAH',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_plans_read_all ON public.subscription_plans
  FOR SELECT USING (true);

-- 2. Extend subscriptions with mega-plan fields (idempotent ALTERs)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_period text CHECK (billing_period IN ('monthly','yearly'));
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS hutko_subscription_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS hutko_customer_id text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_hutko ON public.subscriptions(hutko_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan_id);

-- 3. payment_history — invoice log (LiqPay + future Hutko)
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'UAH',
  status text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  provider text,              -- 'liqpay' | 'hutko' | ...
  hutko_payment_id text,
  liqpay_payment_id text,
  invoice_url text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_profile ON public.payment_history(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON public.payment_history(subscription_id);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_history_owner_read ON public.payment_history
  FOR SELECT USING (profile_id = auth.uid());

-- 4. Seed plan catalogue (idempotent via slug UNIQUE — UPSERT pattern)
INSERT INTO public.subscription_plans (slug, tier, name, description, price_monthly, price_yearly, currency, features, limits, sort_order)
VALUES
  ('free', 'starter',
    '{"ru":"Free","en":"Free","uk":"Free"}'::jsonb,
    '{"ru":"Для старта","en":"Get started","uk":"Для старту"}'::jsonb,
    0, 0, 'UAH',
    '["basic_calendar","basic_clients","basic_finance"]'::jsonb,
    '{"max_clients":20,"max_masters":1,"max_appointments_per_month":50}'::jsonb,
    0),
  ('pro', 'pro',
    '{"ru":"Pro","en":"Pro","uk":"Pro"}'::jsonb,
    '{"ru":"Для solo-мастеров","en":"For solo pros","uk":"Для solo-майстрів"}'::jsonb,
    799, 7990, 'UAH',
    '["unlimited_clients","unlimited_appointments","voice_ai","portfolio","marketing","referrals","pdf_reports","priority_support"]'::jsonb,
    '{"max_clients":-1,"max_masters":1,"max_appointments_per_month":-1}'::jsonb,
    10),
  ('business', 'business',
    '{"ru":"Business","en":"Business","uk":"Business"}'::jsonb,
    '{"ru":"Для салонов и команд","en":"For salons & teams","uk":"Для салонів та команд"}'::jsonb,
    1999, 19990, 'UAH',
    '["everything_in_pro","team","owner_dashboard","payouts","unified_catalog","receptionist","shared_inventory"]'::jsonb,
    '{"max_clients":-1,"max_masters":-1,"max_appointments_per_month":-1}'::jsonb,
    20)
ON CONFLICT (slug) DO UPDATE SET
  tier = EXCLUDED.tier,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 5. Touch trigger for updated_at on subscription_plans
CREATE OR REPLACE FUNCTION public.touch_subscription_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_plans_touch ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_touch
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_plan_updated_at();
