-- 00135_referral_notification.sql
--
-- Add Telegram notification to the referrer when their referee completes
-- their first paid visit. Hooks into the existing `award_referral_reward`
-- function — adds a single INSERT INTO notifications at the end of the
-- happy-path (after the loyalty transaction is recorded).

CREATE OR REPLACE FUNCTION public.award_referral_reward(p_referee_appointment_id uuid)
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE
  v_master_id    uuid;
  v_referee_id   uuid;
  v_referrer_id  uuid;
  v_reward       numeric;
  v_visit_count  int;
  v_enabled      boolean;
  v_master_name  text;
  v_currency     text;
BEGIN
  SELECT a.master_id, c.profile_id INTO v_master_id, v_referee_id
  FROM appointments a JOIN clients c ON c.id = a.client_id
  WHERE a.id = p_referee_appointment_id AND a.status = 'completed';
  IF v_master_id IS NULL THEN RETURN 0; END IF;

  SELECT count(*) INTO v_visit_count
  FROM appointments a JOIN clients c2 ON c2.id = a.client_id
  WHERE c2.profile_id = v_referee_id AND a.master_id = v_master_id AND a.status = 'completed';
  IF v_visit_count <> 1 THEN RETURN 0; END IF;

  SELECT referrer_profile_id INTO v_referrer_id
  FROM referrals WHERE referred_profile_id = v_referee_id LIMIT 1;
  IF v_referrer_id IS NULL OR v_referrer_id = v_referee_id THEN RETURN 0; END IF;

  SELECT loyalty_enabled, loyalty_referral_reward INTO v_enabled, v_reward
  FROM masters WHERE id = v_master_id;
  IF NOT v_enabled OR v_reward <= 0 THEN RETURN 0; END IF;

  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE master_id = v_master_id AND profile_id = v_referrer_id
      AND kind = 'referral_reward' AND appointment_id = p_referee_appointment_id
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO loyalty_balances (master_id, profile_id, balance, lifetime_earned, last_earned_at)
  VALUES (v_master_id, v_referrer_id, v_reward, v_reward, now())
  ON CONFLICT (master_id, profile_id) DO UPDATE
    SET balance         = loyalty_balances.balance + EXCLUDED.balance,
        lifetime_earned = loyalty_balances.lifetime_earned + EXCLUDED.lifetime_earned,
        last_earned_at  = EXCLUDED.last_earned_at;

  INSERT INTO loyalty_transactions (master_id, profile_id, amount, kind, appointment_id, note)
  VALUES (v_master_id, v_referrer_id, v_reward, 'referral_reward', p_referee_appointment_id,
    'Referrer reward for new client first paid visit');

  -- NEW: Telegram notification to the referrer
  SELECT COALESCE(m.display_name, p.full_name, 'Мастер') INTO v_master_name
  FROM masters m LEFT JOIN profiles p ON p.id = m.profile_id
  WHERE m.id = v_master_id;

  INSERT INTO notifications (profile_id, channel, status, scheduled_for, title, body, data)
  VALUES (
    v_referrer_id,
    'telegram',
    'pending',
    now(),
    '🎉 Спасибо за рекомендацию!',
    'Твой друг записался к ' || COALESCE(v_master_name, 'мастеру') || '.' || E'\n' ||
    'Тебе начислено ' || v_reward::text || ' бонусов.',
    jsonb_build_object(
      'kind', 'referral_reward',
      'master_id', v_master_id,
      'amount', v_reward,
      'appointment_id', p_referee_appointment_id
    )
  );

  RETURN v_reward;
END;
$$;
