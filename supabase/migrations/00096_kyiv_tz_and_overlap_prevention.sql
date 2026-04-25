/** --- YAML
 * name: Kyiv timezone in notifications + appointment overlap prevention
 * description: Already applied to prod via MCP. This file mirrors the live state.
 *   1) dispatch_booking_notification + trg_booking_deleted format starts_at in
 *      Europe/Kyiv tz (was raw UTC text — confused users about real time)
 *   2) New BEFORE INSERT/UPDATE trigger on appointments rejects overlaps with:
 *      - Other active appointments of same master (status booked/confirmed/in_progress)
 *      - blocked_times of same master
 *      Group sessions (same master+service+time) are allowed (multiple clients)
 * created: 2026-04-25
 * --- */

-- Notification timezone
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
  v_title text;
  v_body text;
  v_local_dt text;
  v_old_local_dt text;
BEGIN
  SELECT
    a.id, a.starts_at, a.client_id, a.master_id, a.service_id,
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

  IF v_apt.id IS NULL OR v_apt.client_profile_id IS NULL THEN RETURN; END IF;

  v_local_dt := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI');

  IF event_type = 'created' THEN
    v_title := 'Запись подтверждена';
    v_body := 'Вы записаны к ' || v_apt.master_name || ' на ' || v_local_dt || '. Услуга: ' || v_apt.service_name || '.';
  ELSIF event_type = 'cancelled' THEN
    v_title := 'Запись отменена';
    v_body := 'Запись к ' || v_apt.master_name || ' на ' || v_local_dt || ' отменена.';
  ELSIF event_type = 'rescheduled' THEN
    v_old_local_dt := to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI');
    v_title := 'Запись перенесена';
    v_body := 'Запись к ' || v_apt.master_name
      || COALESCE(' с ' || v_old_local_dt, '')
      || ' перенесена на ' || v_local_dt || '.';
  ELSE RETURN; END IF;

  PERFORM 1 FROM notifications
  WHERE profile_id = v_apt.client_profile_id
    AND data->>'apt_id' = apt_id::text
    AND data->>'kind' = 'booking_' || event_type
    AND created_at > now() - interval '5 minutes';
  IF FOUND THEN RETURN; END IF;

  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (v_apt.client_profile_id, 'telegram', v_title, v_body,
    jsonb_build_object('kind', 'booking_' || event_type, 'apt_id', apt_id, 'master_id', v_apt.master_id),
    'pending', now());
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_booking_notification(%, %): %', event_type, apt_id, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_booking_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_profile_id uuid;
  v_master_name text;
  v_local_dt text;
  v_body text;
BEGIN
  IF OLD.status NOT IN ('booked', 'confirmed') THEN RETURN OLD; END IF;
  SELECT c.profile_id, COALESCE(m.display_name, mp.full_name, 'мастер')::text
  INTO v_client_profile_id, v_master_name
  FROM clients c
  LEFT JOIN masters m ON m.id = OLD.master_id
  LEFT JOIN profiles mp ON mp.id = m.profile_id
  WHERE c.id = OLD.client_id;
  IF v_client_profile_id IS NULL THEN RETURN OLD; END IF;
  v_local_dt := to_char(OLD.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI');
  v_body := 'Запись к ' || v_master_name || ' на ' || v_local_dt || ' удалена.';
  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (v_client_profile_id, 'telegram', 'Запись удалена', v_body,
    jsonb_build_object('kind', 'booking_deleted', 'apt_id', OLD.id, 'master_id', OLD.master_id),
    'pending', now());
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_booking_deleted(%): %', OLD.id, SQLERRM;
  RETURN OLD;
END;
$$;

-- Overlap prevention
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_conflict record;
BEGIN
  IF NEW.status IN ('cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show') THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.starts_at, a.ends_at, COALESCE(s.name, '?') AS service_name, c.full_name AS client_name
  INTO v_conflict
  FROM appointments a
  LEFT JOIN services s ON s.id = a.service_id
  LEFT JOIN clients c ON c.id = a.client_id
  WHERE a.master_id = NEW.master_id
    AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND a.status IN ('booked', 'confirmed', 'in_progress')
    AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
    AND NOT (
      a.service_id = NEW.service_id
      AND a.starts_at = NEW.starts_at
      AND a.ends_at = NEW.ends_at
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'time_slot_taken'
      USING DETAIL = format('Время %s – %s занято: %s (клиент: %s)',
        to_char(v_conflict.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI'),
        to_char(v_conflict.ends_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI'),
        v_conflict.service_name, COALESCE(v_conflict.client_name, '?')),
      HINT = 'Выберите другое время или удалите конфликтующую запись';
  END IF;

  PERFORM 1 FROM blocked_times bt
  WHERE bt.master_id = NEW.master_id
    AND tstzrange(bt.starts_at, bt.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)');
  IF FOUND THEN
    RAISE EXCEPTION 'time_slot_blocked'
      USING DETAIL = 'Это время заблокировано (обед / выходной / другая блокировка)',
      HINT = 'Выберите другое время';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_no_overlap ON public.appointments;
CREATE TRIGGER trg_appointments_no_overlap
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, master_id, service_id, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.check_appointment_overlap();
