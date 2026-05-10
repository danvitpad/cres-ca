/** --- YAML
 * name: Booking Trigger — Clean Nominatim Address Mess
 * description: Адрес мастера часто приходит из reverse-geocode Nominatim как
 *              «25, улица Амосова, 625-й микрорайон, Салтовка, Немышлянский
 *              район, Харьков, Харківська міська громада, Харьковский район,
 *              Харьковская область, 61176, Украина» — клиент не должен это
 *              читать в TG-уведомлениях.
 *              Добавляет SQL-аналог JS cleanAddress (lib/format/address.ts):
 *              режет «громада/район/область/країна/индекс», дедуп. Триггер
 *              dispatch_booking_notification теперь зовёт его при сборке
 *              v_address_label.
 * created: 2026-05-10
 * --- */

CREATE OR REPLACE FUNCTION public._clean_address(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[];
  result text[];
  p text;
  prev text := '';
BEGIN
  IF raw IS NULL OR length(trim(raw)) = 0 THEN RETURN ''; END IF;

  parts := string_to_array(raw, ',');
  result := ARRAY[]::text[];

  FOREACH p IN ARRAY parts LOOP
    p := trim(p);
    IF p = '' THEN CONTINUE; END IF;
    -- Postal code (5-6 digits)
    IF p ~ '^\d{5,6}$' THEN CONTINUE; END IF;
    -- Admin noise (case-insensitive)
    IF lower(p) ~ '(громада|район|область|країна|страна|country|україна|украина|ukraine|oblast|raion|gromada|hromada)' THEN CONTINUE; END IF;
    -- Dedup adjacent duplicates
    IF p = prev THEN CONTINUE; END IF;
    result := result || p;
    prev := p;
  END LOOP;

  RETURN array_to_string(result, ', ');
END;
$$;

-- Re-define dispatch_booking_notification — same as 00149 but address goes
-- through _clean_address before assembly.
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
  v_kind text;
  v_apt record;
  v_template record;
  v_default_title text;
  v_default_body text;
  v_title text;
  v_body text;
  v_local_dt text;
  v_local_time text;
  v_old_local_dt text;
  v_old_local_time text;
  v_date_label text;
  v_old_date_label text;
  v_price_label text;
  v_address_label text;
  v_clean_service text;
  v_currency_label text;
  v_currency text;
  v_duration_label text;
  v_dur_h int;
  v_dur_m int;
  v_baseurl text := 'https://cres-ca.com';
BEGIN
  v_kind := CASE event_type
    WHEN 'created' THEN 'booking_confirmation'
    WHEN 'cancelled' THEN 'appointment_cancelled'
    WHEN 'rescheduled' THEN 'appointment_rescheduled'
    ELSE NULL
  END;
  IF v_kind IS NULL THEN RETURN; END IF;

  SELECT
    a.id, a.starts_at, a.ends_at, a.client_id, a.master_id, a.service_id,
    a.price       AS apt_price,
    a.currency    AS apt_currency,
    c.profile_id  AS client_profile_id,
    COALESCE(c.full_name, 'клієнт')::text                          AS client_name,
    COALESCE(m.display_name, mp.full_name, 'майстер')::text        AS master_name,
    COALESCE(s.name, 'послуга')::text                              AS service_name,
    s.price            AS svc_price,
    s.currency         AS svc_currency,
    s.duration_minutes AS duration_minutes,
    m.address          AS m_address,
    m.city             AS m_city,
    m.workplace_name   AS m_workplace
  INTO v_apt
  FROM appointments a
  LEFT JOIN clients c   ON c.id = a.client_id
  LEFT JOIN masters m   ON m.id = a.master_id
  LEFT JOIN profiles mp ON mp.id = m.profile_id
  LEFT JOIN services s  ON s.id = a.service_id
  WHERE a.id = apt_id;

  IF v_apt.id IS NULL OR v_apt.client_profile_id IS NULL THEN RETURN; END IF;

  v_local_dt   := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI');
  v_local_time := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');
  v_date_label := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD ') ||
    CASE EXTRACT(MONTH FROM v_apt.starts_at AT TIME ZONE 'Europe/Kyiv')::int
      WHEN 1 THEN 'січня' WHEN 2 THEN 'лютого' WHEN 3 THEN 'березня'
      WHEN 4 THEN 'квітня' WHEN 5 THEN 'травня' WHEN 6 THEN 'червня'
      WHEN 7 THEN 'липня' WHEN 8 THEN 'серпня' WHEN 9 THEN 'вересня'
      WHEN 10 THEN 'жовтня' WHEN 11 THEN 'листопада' WHEN 12 THEN 'грудня'
    END;

  v_old_local_dt   := COALESCE(to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI'), '');
  v_old_local_time := COALESCE(to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI'), '');
  v_old_date_label := CASE WHEN old_starts_at IS NULL THEN '' ELSE
    to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD ') ||
    CASE EXTRACT(MONTH FROM old_starts_at AT TIME ZONE 'Europe/Kyiv')::int
      WHEN 1 THEN 'січня' WHEN 2 THEN 'лютого' WHEN 3 THEN 'березня'
      WHEN 4 THEN 'квітня' WHEN 5 THEN 'травня' WHEN 6 THEN 'червня'
      WHEN 7 THEN 'липня' WHEN 8 THEN 'серпня' WHEN 9 THEN 'вересня'
      WHEN 10 THEN 'жовтня' WHEN 11 THEN 'листопада' WHEN 12 THEN 'грудня'
    END END;

  v_clean_service := regexp_replace(
    v_apt.service_name,
    '\s*\((индивид\.|индивидуально|индивидуальный|индивидуальная|individual)\)',
    '', 'gi'
  );

  v_currency := COALESCE(v_apt.apt_currency, v_apt.svc_currency, 'UAH');
  v_currency_label := CASE v_currency
    WHEN 'UAH' THEN '₴' WHEN 'USD' THEN '$' WHEN 'EUR' THEN '€'
    WHEN 'RUB' THEN '₽' WHEN 'PLN' THEN 'zł' WHEN 'GBP' THEN '£'
    ELSE v_currency
  END;

  v_price_label := CASE
    WHEN v_apt.apt_price IS NOT NULL AND v_apt.apt_price > 0 THEN
      CASE WHEN v_apt.apt_price = trunc(v_apt.apt_price) THEN
        regexp_replace(to_char(v_apt.apt_price::int, 'FM999G999G990'), '[,.]', ' ', 'g')
      ELSE regexp_replace(to_char(v_apt.apt_price, 'FM999G999G990D00'), ',', ' ', 1)
      END || ' ' || v_currency_label
    WHEN v_apt.svc_price IS NOT NULL AND v_apt.svc_price > 0 THEN
      CASE WHEN v_apt.svc_price = trunc(v_apt.svc_price) THEN
        regexp_replace(to_char(v_apt.svc_price::int, 'FM999G999G990'), '[,.]', ' ', 'g')
      ELSE regexp_replace(to_char(v_apt.svc_price, 'FM999G999G990D00'), ',', ' ', 1)
      END || ' ' || v_currency_label
    ELSE ''
  END;

  v_dur_h := COALESCE(v_apt.duration_minutes, 0) / 60;
  v_dur_m := COALESCE(v_apt.duration_minutes, 0) % 60;
  v_duration_label := CASE
    WHEN COALESCE(v_apt.duration_minutes, 0) = 0 THEN ''
    WHEN v_dur_h > 0 AND v_dur_m > 0 THEN v_dur_h || ' год ' || v_dur_m || ' хв'
    WHEN v_dur_h > 0 THEN v_dur_h || ' год'
    ELSE v_apt.duration_minutes || ' хв'
  END;

  -- Address: workplace, city, cleaned street (через _clean_address)
  v_address_label := array_to_string(
    ARRAY(SELECT trim(x) FROM unnest(ARRAY[
      COALESCE(v_apt.m_workplace, ''),
      COALESCE(v_apt.m_city, ''),
      public._clean_address(v_apt.m_address)
    ]) AS x WHERE trim(x) <> ''), ', ');

  SELECT subject, content INTO v_template
  FROM message_templates
  WHERE master_id = v_apt.master_id AND kind = v_kind AND is_active = true
  LIMIT 1;

  IF event_type = 'created' THEN
    v_default_title := '✅ Запис підтверджено';
    v_default_body :=
      'Майстер ' || v_apt.master_name || ' чекає тебе ' || v_date_label || ' о ' || v_local_time || '.' || E'\n' ||
      'Послуга: ' || v_clean_service ||
      CASE
        WHEN v_duration_label <> '' AND v_price_label <> '' THEN ' (' || v_duration_label || ', ' || v_price_label || ')'
        WHEN v_duration_label <> '' THEN ' (' || v_duration_label || ')'
        WHEN v_price_label <> ''    THEN ' (' || v_price_label || ')'
        ELSE ''
      END || '.' ||
      CASE WHEN v_address_label <> '' THEN E'\nАдреса: ' || v_address_label ELSE '' END ||
      E'\n\nЯкщо плани зміняться — повідом заздалегідь 🙏';
  ELSIF event_type = 'cancelled' THEN
    v_default_title := '❌ Запис скасовано';
    v_default_body :=
      'Майстер: ' || v_apt.master_name || E'\n' ||
      'Послуга: ' || v_clean_service || E'\n' ||
      v_date_label || ' о ' || v_local_time ||
      E'\n\nЗапишись на інший час, коли буде зручно 🙂';
  ELSIF event_type = 'rescheduled' THEN
    v_default_title := '🔄 Запис перенесено';
    v_default_body :=
      v_apt.master_name || ' · ' || v_clean_service || E'\n' ||
      'Було: ' || v_old_date_label || ' о ' || v_old_local_time || E'\n' ||
      'Стало: ' || v_date_label || ' о ' || v_local_time;
  END IF;

  v_title := COALESCE(NULLIF(v_template.subject, ''), v_default_title);
  v_body  := COALESCE(NULLIF(v_template.content, ''), v_default_body);

  v_title := replace(v_title, '{service_name}', v_clean_service);
  v_title := replace(v_title, '{master_name}',  v_apt.master_name);
  v_title := replace(v_title, '{client_name}',  v_apt.client_name);
  v_title := replace(v_title, '{time}',         v_local_dt);
  v_title := replace(v_title, '{date}',         v_date_label);
  v_title := replace(v_title, '{old_time}',     v_old_local_dt);
  v_title := replace(v_title, '{old_date}',     v_old_date_label);
  v_title := replace(v_title, '{price}',        v_price_label);
  v_title := replace(v_title, '{address}',      v_address_label);
  v_title := replace(v_title, '{duration}',     v_duration_label);
  v_title := replace(v_title, '{confirm_url}',  v_baseurl || '/confirm/' || apt_id::text);

  v_body := replace(v_body, '{service_name}', v_clean_service);
  v_body := replace(v_body, '{master_name}',  v_apt.master_name);
  v_body := replace(v_body, '{client_name}',  v_apt.client_name);
  v_body := replace(v_body, '{time}',         v_local_dt);
  v_body := replace(v_body, '{date}',         v_date_label);
  v_body := replace(v_body, '{old_time}',     v_old_local_dt);
  v_body := replace(v_body, '{old_date}',     v_old_date_label);
  v_body := replace(v_body, '{price}',        v_price_label);
  v_body := replace(v_body, '{address}',      v_address_label);
  v_body := replace(v_body, '{duration}',     v_duration_label);
  v_body := replace(v_body, '{confirm_url}',  v_baseurl || '/confirm/' || apt_id::text);

  PERFORM 1 FROM notifications
  WHERE profile_id = v_apt.client_profile_id
    AND data->>'apt_id' = apt_id::text
    AND data->>'kind' = 'booking_' || event_type
    AND created_at > now() - interval '5 minutes';
  IF FOUND THEN RETURN; END IF;

  INSERT INTO notifications (profile_id, channel, title, body, data, status, scheduled_for)
  VALUES (
    v_apt.client_profile_id, 'telegram', v_title, v_body,
    jsonb_build_object('kind', 'booking_' || event_type, 'apt_id', apt_id, 'master_id', v_apt.master_id),
    'pending', now()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_booking_notification(%, %): %', event_type, apt_id, SQLERRM;
END;
$$;
