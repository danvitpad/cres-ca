/** --- YAML
 * name: Waitlist — Smart Matching + 30-min Reservation
 * description: Полный рефакторинг матчинга листа ожидания.
 *              1) Добавляет waitlist.reserved_until — окно 30 мин на ответ.
 *              2) Helper _waitlist_time_matches(prefs, hour) — проверяет
 *                 morning/afternoon/evening/any.
 *              3) Helper _waitlist_try_match(master_id, service_id, starts_at,
 *                 apt_id) — ядро матчинга. Возвращает waitlist_id или NULL.
 *                 - Уважает preferred_days, preferred_time_window, expires_at.
 *                 - Берёт ОДНОГО (FIFO).
 *                 - Резервирует на 30 мин (status='matched', reserved_until).
 *                 - Вставляет TG-уведомление в notifications с inline-кнопкой
 *                   «📅 Записатися» (URL содержит ?from_waitlist=<id>).
 *              4) Триггер match_waitlist_on_cancel — на UPDATE OF status.
 *                 Просто делегирует в _waitlist_try_match.
 *              Cron /api/cron/waitlist-fill откатывает истёкшие резервы и для
 *              них перезапускает матчинг через тот же helper.
 * created: 2026-05-10
 * --- */

-- 1. Резервационное окно (30 мин)
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

CREATE INDEX IF NOT EXISTS waitlist_reserved_until_idx
  ON waitlist (status, reserved_until)
  WHERE status = 'matched';

-- 2. Helper: проверка попадания часа в окно
CREATE OR REPLACE FUNCTION public._waitlist_time_matches(prefs text, slot_local_hour int)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE COALESCE(prefs, 'any')
    WHEN 'morning'   THEN slot_local_hour BETWEEN 9  AND 11
    WHEN 'afternoon' THEN slot_local_hour BETWEEN 12 AND 16
    WHEN 'evening'   THEN slot_local_hour BETWEEN 17 AND 20
    ELSE TRUE
  END;
$$;

-- 3. Ядро матчинга: один клиент, резерв 30 мин, TG-уведомление в очередь.
--    Возвращает id найденного waitlist-record или NULL.
--    Используется и триггером, и cron'ом для re-match после reset резерва.
CREATE OR REPLACE FUNCTION public._waitlist_try_match(
  p_master_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_apt_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_master_name text;
  v_service_name text;
  v_slot_hour int;
  v_slot_dow int;
  v_date_label text;
  v_time_label text;
  v_book_url text;
  v_baseurl text := 'https://cres-ca.com';
BEGIN
  v_slot_hour := EXTRACT(HOUR FROM p_starts_at AT TIME ZONE 'Europe/Kyiv')::int;
  v_slot_dow  := EXTRACT(DOW  FROM p_starts_at AT TIME ZONE 'Europe/Kyiv')::int;

  SELECT w.id, w.client_profile_id, w.service_id INTO v_match
  FROM waitlist w
  WHERE w.master_id = p_master_id
    AND w.status = 'waiting'
    AND w.expires_at > now()
    AND (w.service_id = p_service_id OR w.service_id IS NULL)
    AND (
      w.preferred_days IS NULL
      OR cardinality(w.preferred_days) = 0
      OR v_slot_dow = ANY(w.preferred_days)
    )
    AND public._waitlist_time_matches(w.preferred_time_window, v_slot_hour)
  ORDER BY w.created_at
  LIMIT 1;

  IF v_match.id IS NULL THEN RETURN NULL; END IF;

  -- Имя мастера / услуги
  SELECT COALESCE(m.display_name, mp.full_name, 'майстер')::text INTO v_master_name
  FROM masters m LEFT JOIN profiles mp ON mp.id = m.profile_id WHERE m.id = p_master_id;

  SELECT COALESCE(s.name, 'послуга')::text INTO v_service_name
  FROM services s WHERE s.id = p_service_id;

  -- UA дата/время
  v_time_label := to_char(p_starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');
  v_date_label := to_char(p_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD ') ||
    CASE EXTRACT(MONTH FROM p_starts_at AT TIME ZONE 'Europe/Kyiv')::int
      WHEN 1 THEN 'січня' WHEN 2 THEN 'лютого' WHEN 3 THEN 'березня'
      WHEN 4 THEN 'квітня' WHEN 5 THEN 'травня' WHEN 6 THEN 'червня'
      WHEN 7 THEN 'липня' WHEN 8 THEN 'серпня' WHEN 9 THEN 'вересня'
      WHEN 10 THEN 'жовтня' WHEN 11 THEN 'листопада' WHEN 12 THEN 'грудня'
    END;

  v_book_url := v_baseurl || '/telegram/book?master=' || p_master_id::text
    || CASE WHEN p_service_id IS NULL THEN '' ELSE '&service=' || p_service_id::text END
    || '&from_waitlist=' || v_match.id::text;

  -- Резервируем за этим клиентом на 30 мин
  UPDATE waitlist
  SET status = 'matched',
      notified_at = now(),
      reserved_until = now() + interval '30 minutes',
      matched_appointment_id = p_apt_id
  WHERE id = v_match.id;

  -- Дедуп уведомлений в пределах 5 мин по тому же waitlist_id
  PERFORM 1 FROM notifications
  WHERE profile_id = v_match.client_profile_id
    AND data->>'kind' = 'waitlist_match'
    AND data->>'waitlist_id' = v_match.id::text
    AND created_at > now() - interval '5 minutes';
  IF FOUND THEN RETURN v_match.id; END IF;

  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (
    v_match.client_profile_id,
    'telegram',
    '🟢 Слот відкрився!',
    'Майстер ' || v_master_name || ' звільнив ' || v_date_label || ' о ' || v_time_label || '.' || E'\n' ||
    'Послуга: ' || v_service_name || E'\n\n' ||
    'Встигни записатися першим — резерв на 30 хвилин 🙌',
    jsonb_build_object(
      'kind', 'waitlist_match',
      'waitlist_id', v_match.id,
      'master_id', p_master_id,
      'cancelled_apt_id', p_apt_id,
      'inline_keyboard', jsonb_build_array(jsonb_build_array(
        jsonb_build_object(
          'text', '📅 Записатися',
          'web_app', jsonb_build_object('url', v_book_url)
        )
      ))
    ),
    'pending',
    now()
  );

  RETURN v_match.id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_waitlist_try_match(apt %): %', p_apt_id, SQLERRM;
  RETURN NULL;
END;
$$;

-- 4. Триггер на отмену будущей записи — вызывает helper
CREATE OR REPLACE FUNCTION public.match_waitlist_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    NEW.status IN ('cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show')
    AND OLD.status NOT IN ('cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show', 'completed')
    AND NEW.starts_at > now()
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public._waitlist_try_match(NEW.master_id, NEW.service_id, NEW.starts_at, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_match_waitlist ON public.appointments;
CREATE TRIGGER appointments_match_waitlist
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.match_waitlist_on_cancel();
