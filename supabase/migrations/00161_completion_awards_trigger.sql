-- =============================================================
-- 00161: Trigger awards on appointment completion
-- =============================================================
--
-- Bug: `award_referral_reward(uuid)` function was defined in 00135
-- and `award_visit_bonus(...)` was referenced in CLAUDE.md as a
-- trigger — but NEITHER is actually called anywhere (no trigger, no
-- cron, no API endpoint). Result: every completed visit silently
-- skips loyalty point credit AND referral reward credit. Bonuses
-- can be REDEEMED (redeem_loyalty_bonus called from /book) but never
-- AWARDED. The wallet shows 0 forever.
--
-- Fix:
-- 1. Define `award_visit_bonus(p_appointment_id uuid)` — credits
--    master's per-visit loyalty bonus to the client when an
--    appointment moves to status='completed', respecting:
--      • masters.loyalty_enabled
--      • masters.loyalty_visit_percent (% from appointment.price)
--      • masters.loyalty_max_per_visit (cap per visit)
--      • dedupe: skip if a 'visit_earn' loyalty_transactions row
--        already exists for (master_id, profile_id, appointment_id)
-- 2. Trigger AFTER UPDATE on appointments — when status transitions
--    to 'completed' from anything else, call both
--    award_visit_bonus AND award_referral_reward.
-- =============================================================

CREATE OR REPLACE FUNCTION public.award_visit_bonus(p_appointment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_id     uuid;
  v_profile_id    uuid;
  v_price         numeric;
  v_loyalty_on    boolean;
  v_percent       numeric;
  v_cap           numeric;
  v_bonus         numeric;
BEGIN
  SELECT a.master_id, c.profile_id, a.price
  INTO v_master_id, v_profile_id, v_price
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id AND a.status = 'completed';

  IF v_master_id IS NULL OR v_profile_id IS NULL THEN RETURN 0; END IF;
  IF v_price IS NULL OR v_price <= 0 THEN RETURN 0; END IF;

  SELECT loyalty_enabled, loyalty_visit_percent, loyalty_max_per_visit
  INTO v_loyalty_on, v_percent, v_cap
  FROM masters WHERE id = v_master_id;

  IF NOT v_loyalty_on OR v_percent IS NULL OR v_percent <= 0 THEN
    RETURN 0;
  END IF;

  v_bonus := round((v_price * v_percent / 100));
  IF v_cap IS NOT NULL AND v_cap > 0 AND v_bonus > v_cap THEN
    v_bonus := v_cap;
  END IF;
  IF v_bonus <= 0 THEN RETURN 0; END IF;

  -- Dedupe: don't double-credit the same appointment
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE master_id = v_master_id
      AND profile_id = v_profile_id
      AND appointment_id = p_appointment_id
      AND kind = 'visit_earn'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO loyalty_balances (master_id, profile_id, balance, lifetime_earned, last_earned_at)
  VALUES (v_master_id, v_profile_id, v_bonus, v_bonus, now())
  ON CONFLICT (master_id, profile_id) DO UPDATE
    SET balance         = loyalty_balances.balance + EXCLUDED.balance,
        lifetime_earned = loyalty_balances.lifetime_earned + EXCLUDED.lifetime_earned,
        last_earned_at  = EXCLUDED.last_earned_at;

  INSERT INTO loyalty_transactions (master_id, profile_id, amount, kind, appointment_id, note)
  VALUES (v_master_id, v_profile_id, v_bonus, 'visit_earn', p_appointment_id,
    'Visit bonus auto-credited on completion');

  RETURN v_bonus;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'award_visit_bonus(%): %', p_appointment_id, SQLERRM;
  RETURN 0;
END;
$$;

-- ─── Completion trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_on_appointment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only react on transition INTO 'completed' (not subsequent updates).
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM public.award_visit_bonus(NEW.id);
    PERFORM public.award_referral_reward(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_appointment_completed ON public.appointments;
CREATE TRIGGER trg_on_appointment_completed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_appointment_completed();
