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

-- Drop legacy master-notification triggers — user explicitly doesn't want master to
-- receive booking lifecycle messages (those are for clients only).
DROP TRIGGER IF EXISTS trg_notify_master_on_appointment_insert ON public.appointments;
DROP TRIGGER IF EXISTS trg_notify_master_on_appointment_cancel ON public.appointments;
DROP FUNCTION IF EXISTS public.notify_master_on_appointment_insert();
DROP FUNCTION IF EXISTS public.notify_master_on_appointment_cancel();

-- Full-format client notification with master / service / date / time / price / duration in Kyiv tz
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
  v_date_label text;
  v_time_label text;
  v_old_date_label text;
  v_old_time_label text;
  v_price_label text;
  v_duration_label text;
  v_currency text;
  v_dur_h int;
  v_dur_m int;
BEGIN
  SELECT
    a.id, a.starts_at, a.ends_at, a.client_id, a.master_id, a.service_id, a.price,
    c.profile_id AS client_profile_id,
    COALESCE(m.display_name, mp.full_name, 'мастер')::text AS master_name,
    COALESCE(s.name, 'услуга')::text AS service_name,
    s.duration_minutes,
    s.currency
  INTO v_apt
  FROM appointments a
  LEFT JOIN clients c ON c.id = a.client_id
  LEFT JOIN masters m ON m.id = a.master_id
  LEFT JOIN profiles mp ON mp.id = m.profile_id
  LEFT JOIN services s ON s.id = a.service_id
  WHERE a.id = apt_id;

  IF v_apt.id IS NULL OR v_apt.client_profile_id IS NULL THEN RETURN; END IF;

  v_date_label := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD ') ||
    CASE EXTRACT(MONTH FROM v_apt.starts_at AT TIME ZONE 'Europe/Kyiv')::int
      WHEN 1 THEN 'января' WHEN 2 THEN 'февраля' WHEN 3 THEN 'марта'
      WHEN 4 THEN 'апреля' WHEN 5 THEN 'мая' WHEN 6 THEN 'июня'
      WHEN 7 THEN 'июля' WHEN 8 THEN 'августа' WHEN 9 THEN 'сентября'
      WHEN 10 THEN 'октября' WHEN 11 THEN 'ноября' WHEN 12 THEN 'декабря'
    END || to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', ' YYYY') || ' г.';
  v_time_label := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');

  v_currency := COALESCE(v_apt.currency, 'UAH');
  -- Format price: integers => '1 000', floats => '1 000.50'. Use space as thousands separator.
  v_price_label := CASE
    WHEN COALESCE(v_apt.price, 0) = floor(COALESCE(v_apt.price, 0)) THEN
      regexp_replace(to_char(COALESCE(v_apt.price, 0)::int, 'FM999G999G990'), '[,.]', ' ', 'g')
    ELSE
      regexp_replace(to_char(COALESCE(v_apt.price, 0), 'FM999G999G990D00'), ',', ' ', 1)
  END || ' ' || v_currency;

  v_dur_h := COALESCE(v_apt.duration_minutes, 0) / 60;
  v_dur_m := COALESCE(v_apt.duration_minutes, 0) % 60;
  v_duration_label := CASE
    WHEN v_dur_h > 0 AND v_dur_m > 0 THEN v_dur_h || ' ч ' || v_dur_m || ' мин'
    WHEN v_dur_h > 0 THEN v_dur_h || ' ч'
    ELSE COALESCE(v_apt.duration_minutes, 0) || ' мин'
  END;

  IF event_type = 'created' THEN
    v_title := '📅 Вас записали на визит';
    v_body :=
      'Мастер: ' || v_apt.master_name || E'\n' ||
      'Услуга: ' || v_apt.service_name || E'\n' ||
      'Дата: ' || v_date_label || E'\n' ||
      'Время: ' || v_time_label || E'\n' ||
      'Стоимость: ' || v_price_label || E'\n' ||
      'Длительность: ' || v_duration_label;
  ELSIF event_type = 'cancelled' THEN
    v_title := '❌ Запись отменена';
    v_body :=
      'Мастер: ' || v_apt.master_name || E'\n' ||
      'Услуга: ' || v_apt.service_name || E'\n' ||
      'Дата: ' || v_date_label || E'\n' ||
      'Время: ' || v_time_label;
  ELSIF event_type = 'rescheduled' THEN
    v_old_date_label := to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM');
    v_old_time_label := to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');
    v_title := '🔄 Запись перенесена';
    v_body :=
      'Мастер: ' || v_apt.master_name || E'\n' ||
      'Услуга: ' || v_apt.service_name || E'\n' ||
      'Было: ' || v_old_date_label || ' ' || v_old_time_label || E'\n' ||
      'Стало: ' || v_date_label || ', ' || v_time_label;
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

-- DELETE shows up to client as 'cancelled' (don't expose hard-delete to client UX)
CREATE OR REPLACE FUNCTION public.trg_booking_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_profile_id uuid;
  v_master_name text;
  v_service_name text;
  v_date_label text;
  v_time_label text;
  v_body text;
BEGIN
  IF OLD.status NOT IN ('booked', 'confirmed') THEN RETURN OLD; END IF;
  SELECT c.profile_id, COALESCE(m.display_name, mp.full_name, 'мастер')::text,
         COALESCE(s.name, 'услуга')::text
  INTO v_client_profile_id, v_master_name, v_service_name
  FROM clients c
  LEFT JOIN masters m ON m.id = OLD.master_id
  LEFT JOIN profiles mp ON mp.id = m.profile_id
  LEFT JOIN services s ON s.id = OLD.service_id
  WHERE c.id = OLD.client_id;
  IF v_client_profile_id IS NULL THEN RETURN OLD; END IF;
  v_date_label := to_char(OLD.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM');
  v_time_label := to_char(OLD.starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');
  v_body := 'Мастер: ' || v_master_name || E'\n' ||
            'Услуга: ' || v_service_name || E'\n' ||
            'Дата: ' || v_date_label || E'\n' ||
            'Время: ' || v_time_label;
  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (v_client_profile_id, 'telegram', '❌ Запись отменена', v_body,
    jsonb_build_object('kind', 'booking_cancelled', 'apt_id', OLD.id, 'master_id', OLD.master_id),
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
  IF NEW.status IN ('cancelled', 'cancelled_by_client', 'no_show', 'completed') THEN
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
