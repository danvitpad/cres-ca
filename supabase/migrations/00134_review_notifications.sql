-- 00134_review_notifications.sql
--
-- Trigger: when a new review is inserted, notify the master in Telegram.
-- Covers all 6 entry points (web review form, mini app, telegram webhook,
-- public /review/[apt_id], etc.) — single trigger handles them all.

CREATE OR REPLACE FUNCTION trg_review_notify_master()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_master_profile_id uuid;
  v_reviewer_name text;
  v_service_name text;
  v_score_label text;
  v_title text;
  v_body text;
BEGIN
  -- Only notify on INSERT (not on edits/score corrections)
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;

  -- target_type='master' is the master review; salon reviews go to admin
  IF NEW.target_type NOT IN ('master', 'salon') THEN RETURN NEW; END IF;

  -- Find master profile_id
  IF NEW.target_type = 'master' THEN
    SELECT m.profile_id INTO v_master_profile_id
    FROM masters m WHERE m.id = NEW.target_id;
  ELSE
    -- salon — owner gets notified
    SELECT s.owner_id INTO v_master_profile_id
    FROM salons s WHERE s.id = NEW.target_id;
  END IF;

  IF v_master_profile_id IS NULL THEN RETURN NEW; END IF;

  -- Build reviewer name (anonymous review → «Анонимно»)
  IF COALESCE(NEW.is_anonymous, false) THEN
    v_reviewer_name := 'Анонимный клиент';
  ELSE
    SELECT COALESCE(p.full_name, 'Клиент') INTO v_reviewer_name
    FROM profiles p WHERE p.id = NEW.reviewer_id;
  END IF;

  -- Build service name from linked appointment (if any)
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT public.clean_service_name(s.name) INTO v_service_name
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.id = NEW.appointment_id;
  END IF;

  -- Build star label
  v_score_label := repeat('⭐', GREATEST(0, LEAST(5, COALESCE(NEW.score, 5))));

  -- Title — happy face for 4-5★, warning for 1-3★ (master should react)
  IF NEW.score >= 4 THEN
    v_title := '🎉 Новый отзыв · ' || v_score_label;
  ELSE
    v_title := '⚠️ Низкая оценка · ' || v_score_label;
  END IF;

  -- Body
  v_body := 'От: ' || v_reviewer_name ||
    CASE WHEN v_service_name IS NOT NULL THEN E'\nУслуга: ' || v_service_name ELSE '' END ||
    CASE WHEN NEW.comment IS NOT NULL AND length(NEW.comment) > 0
         THEN E'\n\n«' || left(NEW.comment, 300) ||
              CASE WHEN length(NEW.comment) > 300 THEN '…»' ELSE '»' END
         ELSE '' END;

  -- Dedup safety — same reviewer/appointment in last 5 min
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE profile_id = v_master_profile_id
      AND data->>'kind' = 'new_review'
      AND data->>'review_id' = NEW.id::text
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (profile_id, channel, status, scheduled_for, title, body, data)
  VALUES (
    v_master_profile_id,
    'telegram',
    'pending',
    now(),
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'new_review',
      'review_id', NEW.id,
      'appointment_id', NEW.appointment_id,
      'target_type', NEW.target_type,
      'target_id', NEW.target_id,
      'score', NEW.score
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_review_notify_master(%, %): %', NEW.target_type, NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_notify_master ON reviews;
CREATE TRIGGER reviews_notify_master
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_review_notify_master();
