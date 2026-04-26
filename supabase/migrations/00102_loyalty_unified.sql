-- 00102_loyalty_unified.sql
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ UNIFIED LOYALTY SYSTEM — phase 1 (schema + master config)           │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Replaces three half-built mechanics with one coherent system:       │
-- │   • profiles.bonus_points  (platform-wide pool, master pays)        │
-- │   • clients.bonus_balance  (per-master, inconsistent UI)            │
-- │   • referrals + birthday   (separate, no master control)            │
-- │ With:                                                                │
-- │   • loyalty_balances(master_id, profile_id, balance, …)              │
-- │       — bonuses live PER MASTER → lock-in. Client can spend a        │
-- │         balance only at the master who issued it.                    │
-- │   • loyalty_transactions  — append-only audit log                    │
-- │   • masters.loyalty_*     — per-master config: %, cap, expiry,       │
-- │         referral reward amount, birthday-gift % + validity days.     │
-- │   • Birthday gift becomes a 30-day promo code, NOT accumulating      │
-- │     points — triggers a return visit instead of sitting on balance.  │
-- │   • Referral reward = master pays a fixed amount only when a NEW     │
-- │     client comes in and pays for their first visit. Inflow-driven,   │
-- │     not discount-on-existing.                                        │
-- │                                                                      │
-- │ This phase ships ONLY the schema + RLS. The earning / spending /     │
-- │ expiry RPCs and the master-side UI ship in phase 2 / phase 3.        │
-- │ Existing UI for bonus spending is already disabled at the app layer  │
-- │ (see CLAUDE.md → Bonus rebuild epic).                                │
-- └─────────────────────────────────────────────────────────────────────┘

-- ── 1. Master config ──────────────────────────────────────────────────
ALTER TABLE public.masters
  ADD COLUMN IF NOT EXISTS loyalty_enabled                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_visit_percent           int     NOT NULL DEFAULT 5
    CHECK (loyalty_visit_percent BETWEEN 0 AND 20),
  ADD COLUMN IF NOT EXISTS loyalty_max_per_visit           numeric NOT NULL DEFAULT 100
    CHECK (loyalty_max_per_visit >= 0),
  ADD COLUMN IF NOT EXISTS loyalty_expiry_months           int     NOT NULL DEFAULT 6
    CHECK (loyalty_expiry_months BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS loyalty_referral_reward         numeric NOT NULL DEFAULT 100
    CHECK (loyalty_referral_reward >= 0),
  ADD COLUMN IF NOT EXISTS loyalty_birthday_enabled        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_birthday_percent        int     NOT NULL DEFAULT 10
    CHECK (loyalty_birthday_percent BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS loyalty_birthday_validity_days  int     NOT NULL DEFAULT 30
    CHECK (loyalty_birthday_validity_days BETWEEN 1 AND 365);

COMMENT ON COLUMN public.masters.loyalty_enabled IS 'Master-level toggle for the entire loyalty programme (visit bonuses + referral + birthday). When false, no flow fires.';
COMMENT ON COLUMN public.masters.loyalty_visit_percent IS 'Percentage of each completed visit price that becomes loyalty balance for the client. 0 disables visit-based earning.';
COMMENT ON COLUMN public.masters.loyalty_max_per_visit IS 'Cap (in UAH) on how many bonus points a single visit can produce.';
COMMENT ON COLUMN public.masters.loyalty_expiry_months IS 'Months before earned points expire. Cron expires them and writes a kind=expiry transaction.';
COMMENT ON COLUMN public.masters.loyalty_referral_reward IS 'Fixed amount the master pays as the referrer-bonus when a new client comes through a referral and pays for their first visit. Should be < average first visit price so master is still net positive.';
COMMENT ON COLUMN public.masters.loyalty_birthday_enabled IS 'Sub-toggle for birthday gift. Only honoured when loyalty_enabled is also true.';
COMMENT ON COLUMN public.masters.loyalty_birthday_percent IS 'Percentage off as a one-time, time-limited promo code on the client birthday (NOT accumulating points).';
COMMENT ON COLUMN public.masters.loyalty_birthday_validity_days IS 'How many days the birthday promo code remains valid. Default 30.';


-- ── 2. Per-(master, client) loyalty balance ──────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_balances (
  master_id          uuid NOT NULL REFERENCES public.masters(id)  ON DELETE CASCADE,
  profile_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance            numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned    numeric NOT NULL DEFAULT 0,
  lifetime_spent     numeric NOT NULL DEFAULT 0,
  last_earned_at     timestamptz,
  last_spent_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (master_id, profile_id)
);

COMMENT ON TABLE public.loyalty_balances IS 'Per-(master, client) loyalty balance. The single source of truth for how many points a specific client has at a specific master. Replaces profiles.bonus_points and clients.bonus_balance.';

CREATE INDEX IF NOT EXISTS idx_loyalty_balances_profile  ON public.loyalty_balances(profile_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_balances_master   ON public.loyalty_balances(master_id);

ALTER TABLE public.loyalty_balances ENABLE ROW LEVEL SECURITY;

-- Client sees their own row at any master
DROP POLICY IF EXISTS loyalty_balances_client_read ON public.loyalty_balances;
CREATE POLICY loyalty_balances_client_read ON public.loyalty_balances
  FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

-- Master sees all balances at their own master_id
DROP POLICY IF EXISTS loyalty_balances_master_read ON public.loyalty_balances;
CREATE POLICY loyalty_balances_master_read ON public.loyalty_balances
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.masters m WHERE m.id = master_id AND m.profile_id = auth.uid()
  ));

-- Writes are restricted to SECURITY DEFINER RPCs — no direct INSERT/UPDATE/DELETE policies.


-- ── 3. Append-only transaction log ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_txn_kind') THEN
    CREATE TYPE public.loyalty_txn_kind AS ENUM (
      'visit_earn',         -- + at appointment completion
      'visit_spend',         -- − when client redeems at a booking
      'referral_reward',     -- + to the referrer when their referee makes first paid visit
      'birthday_promo',      -- 0 — informational, the actual reward is a promo_code
      'manual_adjustment',  -- ± when master manually credits/debits
      'expiry'               -- − when balance expires
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       uuid NOT NULL REFERENCES public.masters(id)  ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount          numeric NOT NULL,
  kind            public.loyalty_txn_kind NOT NULL,
  appointment_id  uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  promo_code_id   uuid REFERENCES public.promo_codes(id)  ON DELETE SET NULL,
  expires_at      timestamptz,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_txn_master_profile ON public.loyalty_transactions(master_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_appointment    ON public.loyalty_transactions(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_expires        ON public.loyalty_transactions(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.loyalty_transactions IS 'Append-only audit log for every loyalty event. Sum of amount per (master_id, profile_id) MUST equal loyalty_balances.balance at any point — this is the bookkeeping proof for the master, the client, and the platform.';

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_txn_client_read ON public.loyalty_transactions;
CREATE POLICY loyalty_txn_client_read ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS loyalty_txn_master_read ON public.loyalty_transactions;
CREATE POLICY loyalty_txn_master_read ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.masters m WHERE m.id = master_id AND m.profile_id = auth.uid()
  ));


-- ── 4. Backfill from legacy clients.bonus_balance ────────────────────
-- profiles.bonus_points was a cross-master pool — the new system requires per-master
-- attribution. We can't reliably know which master "owns" a profile.bonus_points
-- value, so we ignore it in this backfill. clients.bonus_balance, however, is
-- already per-master and can be migrated cleanly.
INSERT INTO public.loyalty_balances (master_id, profile_id, balance, lifetime_earned)
SELECT c.master_id, c.profile_id, c.bonus_balance, c.bonus_balance
FROM public.clients c
WHERE c.profile_id IS NOT NULL
  AND COALESCE(c.bonus_balance, 0) > 0
ON CONFLICT (master_id, profile_id) DO UPDATE
  SET balance         = EXCLUDED.balance,
      lifetime_earned = EXCLUDED.lifetime_earned;

-- Mirror entries into the audit log so future calculations balance.
INSERT INTO public.loyalty_transactions (master_id, profile_id, amount, kind, note)
SELECT c.master_id, c.profile_id, c.bonus_balance, 'manual_adjustment',
  'Backfill from clients.bonus_balance on schema migration 00102'
FROM public.clients c
WHERE c.profile_id IS NOT NULL
  AND COALESCE(c.bonus_balance, 0) > 0;


-- ── 5. updated_at trigger on loyalty_balances ────────────────────────
CREATE OR REPLACE FUNCTION public.set_loyalty_balances_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_loyalty_balances_updated ON public.loyalty_balances;
CREATE TRIGGER trg_loyalty_balances_updated
  BEFORE UPDATE ON public.loyalty_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_loyalty_balances_updated_at();
