/** --- YAML
 * name: Booking Lifecycle Notifications Trigger
 * description: Postgres trigger on appointments INSERT/UPDATE creates immediate
 *              client-facing notifications: created / cancelled / rescheduled.
 *              Inserts into notifications table with scheduled_for=now(); existing
 *              cron `/api/cron/notifications` (every 5 min) delivers them via TG/email.
 *              Idempotent and safe to re-run.
 * created: 2026-04-25
 * --- */

-- ============================================================
-- Helper function: dispatch booking event
-- ============================================================

CREATE OR REPLACE FUNCTION public.dispatch_booking_notification(
  event_type text,
  apt_id uuid,
  old_starts_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apt record;
  v_client_profile_id uuid;
  v_master_name text;
  v_service_name text;
  v_title text;
  v_body text;
  v_local_dt text;
BEGIN
  -- Fetch enriched appointment context
  SELECT
    a.id,
    a.starts_at,
    a.client_id,
    a.master_id,
    a.service_id,
    c.profile_id AS client_profile_id,
    COALESCE(m.display_name, mp.full_name, 'мастер')::text AS master_name,
    COALESCE(s.name, 'услуга')::text AS service_name
  INTO v_apt
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  LEFT JOIN masters m ON m.id = a.master_id
  LEFT JOIN profiles mp ON mp.id = m.profile_id
  LEFT JOIN services s ON s.id = a.service_id
  WHERE a.id = apt_id;

  IF v_apt.id IS NULL OR v_apt.client_profile_id IS NULL THEN
    RETURN;  -- no client profile (anonymous walk-in) — skip
  END IF;

  v_local_dt := to_char(v_apt.starts_at, 'DD.MM HH24:MI');

  IF event_type = 'created' THEN
    v_title := 'Запись подтверждена';
    v_body := 'Вы записаны к ' || v_apt.master_name || ' на ' || v_local_dt || '. Услуга: ' || v_apt.service_name || '.';
  ELSIF event_type = 'cancelled' THEN
    v_title := 'Запись отменена';
    v_body := 'Запись к ' || v_apt.master_name || ' на ' || v_local_dt || ' отменена.';
  ELSIF event_type = 'rescheduled' THEN
    v_title := 'Запись перенесена';
    v_body := 'Запись к ' || v_apt.master_name
      || COALESCE(' с ' || to_char(old_starts_at, 'DD.MM HH24:MI'), '')
      || ' перенесена на ' || v_local_dt || '.';
  ELSE
    RETURN;
  END IF;

  -- Dedupe: skip if same event already exists for this appointment in last 5 min
  PERFORM 1 FROM notifications
  WHERE profile_id = v_apt.client_profile_id
    AND data->>'apt_id' = apt_id::text
    AND data->>'kind' = 'booking_' || event_type
    AND created_at > now() - interval '5 minutes';
  IF FOUND THEN RETURN; END IF;

  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (
    v_apt.client_profile_id,
    'telegram',
    v_title,
    v_body,
    jsonb_build_object('kind', 'booking_' || event_type, 'apt_id', apt_id, 'master_id', v_apt.master_id),
    'pending',
    now()
  );
EXCEPTION WHEN OTHERS THEN
  -- Never break the appointment write because of notification failure
  RAISE WARNING 'dispatch_booking_notification(%, %): %', event_type, apt_id, SQLERRM;
END;
$$;

-- ============================================================
-- Trigger: AFTER INSERT — booking_created
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_booking_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify for active bookings (skip cancelled / no_show etc on creation)
  IF NEW.status IN ('booked', 'confirmed') THEN
    PERFORM public.dispatch_booking_notification('created', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_booking_created ON public.appointments;
CREATE TRIGGER trg_appointments_booking_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_booking_created();

-- ============================================================
-- Trigger: AFTER UPDATE — booking_cancelled / booking_rescheduled
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_booking_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_active boolean;
  v_now_cancelled boolean;
BEGIN
  v_was_active := OLD.status IN ('booked', 'confirmed', 'in_progress');
  v_now_cancelled := NEW.status IN ('cancelled', 'cancelled_by_client', 'no_show');

  -- Cancellation: was active, now cancelled
  IF v_was_active AND v_now_cancelled THEN
    PERFORM public.dispatch_booking_notification('cancelled', NEW.id);
    RETURN NEW;
  END IF;

  -- Reschedule: starts_at changed, status still active
  IF NEW.status IN ('booked', 'confirmed')
     AND OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN
    PERFORM public.dispatch_booking_notification('rescheduled', NEW.id, OLD.starts_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_booking_updated ON public.appointments;
CREATE TRIGGER trg_appointments_booking_updated
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_booking_updated();

-- ============================================================
-- Trigger: AFTER DELETE — treat hard delete as cancellation
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_booking_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_profile_id uuid;
  v_master_name text;
  v_local_dt text;
  v_body text;
BEGIN
  IF OLD.status NOT IN ('booked', 'confirmed') THEN
    RETURN OLD;  -- already cancelled/completed — don't re-notify
  END IF;

  SELECT c.profile_id, COALESCE(m.display_name, mp.full_name, 'мастер')::text
  INTO v_client_profile_id, v_master_name
  FROM clients c
  LEFT JOIN masters m ON m.id = OLD.master_id
  LEFT JOIN profiles mp ON mp.id = m.profile_id
  WHERE c.id = OLD.client_id;

  IF v_client_profile_id IS NULL THEN RETURN OLD; END IF;

  v_local_dt := to_char(OLD.starts_at, 'DD.MM HH24:MI');
  v_body := 'Запись к ' || v_master_name || ' на ' || v_local_dt || ' удалена.';

  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (
    v_client_profile_id,
    'telegram',
    'Запись удалена',
    v_body,
    jsonb_build_object('kind', 'booking_deleted', 'apt_id', OLD.id, 'master_id', OLD.master_id),
    'pending',
    now()
  );
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_booking_deleted(%): %', OLD.id, SQLERRM;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_booking_deleted ON public.appointments;
CREATE TRIGGER trg_appointments_booking_deleted
  AFTER DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_booking_deleted();
