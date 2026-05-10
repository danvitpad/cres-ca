/** --- YAML
 * name: Booking Lifecycle — Master-customizable Templates (preserves 00096 rich defaults)
 * description: dispatch_booking_notification теперь читает кастомный шаблон мастера
 *              (kind = booking_confirmation / appointment_rescheduled /
 *              appointment_cancelled) и подставляет переменные {service_name},
 *              {master_name}, {client_name}, {time}, {old_time}, {date},
 *              {old_date}, {price}, {address}, {duration}, {confirm_url}.
 *              Если шаблона нет — fallback на 00096-формат (4/6/4 строки с
 *              русскими месяцами, ценой и длительностью). Триггеры
 *              trg_booking_created/updated/deleted не меняются.
 * created: 2026-05-10
 * --- */

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
  v_old_local_dt text;
  v_date_label text;
  v_old_date_label text;
  v_old_time_label text;
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
  -- Map event_type → template kind
  v_kind := CASE event_type
    WHEN 'created' THEN 'booking_confirmation'
    WHEN 'cancelled' THEN 'appointment_cancelled'
    WHEN 'rescheduled' THEN 'appointment_rescheduled'
    ELSE NULL
  END;
  IF v_kind IS NULL THEN RETURN; END IF;

  -- Fetch enriched appointment context
  SELECT
    a.id, a.starts_at, a.ends_at, a.client_id, a.master_id, a.service_id,
    a.price       AS apt_price,
    a.currency    AS apt_currency,
    c.profile_id  AS client_profile_id,
    COALESCE(c.full_name, 'клиент')::text                          AS client_name,
    COALESCE(m.display_name, mp.full_name, 'мастер')::text         AS master_name,
    COALESCE(s.name, 'услуга')::text                               AS service_name,
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

  IF v_apt.id IS NULL OR v_apt.client_profile_id IS NULL THEN
    RETURN;  -- no client profile (anonymous walk-in) — skip
  END IF;

  -- Time labels: Europe/Kyiv (server tz is UTC, users are in UA).
  -- v_local_dt = "DD.MM HH24:MI" — used for {time} substitution.
  -- v_date_label = "DD месяца YYYY г." — used in 00096-format defaults.
  v_local_dt := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI');
  v_date_label := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD ') ||
    CASE EXTRACT(MONTH FROM v_apt.starts_at AT TIME ZONE 'Europe/Kyiv')::int
      WHEN 1 THEN 'января' WHEN 2 THEN 'февраля' WHEN 3 THEN 'марта'
      WHEN 4 THEN 'апреля' WHEN 5 THEN 'мая' WHEN 6 THEN 'июня'
      WHEN 7 THEN 'июля' WHEN 8 THEN 'августа' WHEN 9 THEN 'сентября'
      WHEN 10 THEN 'октября' WHEN 11 THEN 'ноября' WHEN 12 THEN 'декабря'
    END || to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', ' YYYY') || ' г.';

  -- Old time labels (only relevant for 'rescheduled')
  v_old_local_dt   := COALESCE(to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI'), '');
  v_old_date_label := COALESCE(to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM'), '');
  v_old_time_label := COALESCE(to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI'), '');

  -- Strip "(индивид.)" decoration from service name (matches cron behavior)
  v_clean_service := regexp_replace(
    v_apt.service_name,
    '\s*\((индивид\.|индивидуально|индивидуальный|индивидуальная|individual)\)',
    '',
    'gi'
  );

  -- Currency symbol
  v_currency := COALESCE(v_apt.apt_currency, v_apt.svc_currency, 'UAH');
  v_currency_label := CASE v_currency
    WHEN 'UAH' THEN '₴'
    WHEN 'USD' THEN '$'
    WHEN 'EUR' THEN '€'
    WHEN 'RUB' THEN '₽'
    WHEN 'PLN' THEN 'zł'
    WHEN 'GBP' THEN '£'
    ELSE v_currency
  END;

  -- Price label "1 350 ₴" (00096-style: thousand separator + currency symbol).
  -- Empty string when no price.
  v_price_label := CASE
    WHEN v_apt.apt_price IS NOT NULL AND v_apt.apt_price > 0 THEN
      CASE
        WHEN v_apt.apt_price = trunc(v_apt.apt_price) THEN
          regexp_replace(to_char(v_apt.apt_price::int, 'FM999G999G990'), '[,.]', ' ', 'g')
        ELSE
          regexp_replace(to_char(v_apt.apt_price, 'FM999G999G990D00'), ',', ' ', 1)
      END || ' ' || v_currency_label
    WHEN v_apt.svc_price IS NOT NULL AND v_apt.svc_price > 0 THEN
      CASE
        WHEN v_apt.svc_price = trunc(v_apt.svc_price) THEN
          regexp_replace(to_char(v_apt.svc_price::int, 'FM999G999G990'), '[,.]', ' ', 'g')
        ELSE
          regexp_replace(to_char(v_apt.svc_price, 'FM999G999G990D00'), ',', ' ', 1)
      END || ' ' || v_currency_label
    ELSE ''
  END;

  -- Duration label "1 ч 30 мин" / "2 ч" / "45 мин" — empty if zero.
  v_dur_h := COALESCE(v_apt.duration_minutes, 0) / 60;
  v_dur_m := COALESCE(v_apt.duration_minutes, 0) % 60;
  v_duration_label := CASE
    WHEN COALESCE(v_apt.duration_minutes, 0) = 0 THEN ''
    WHEN v_dur_h > 0 AND v_dur_m > 0 THEN v_dur_h || ' ч ' || v_dur_m || ' мин'
    WHEN v_dur_h > 0 THEN v_dur_h || ' ч'
    ELSE v_apt.duration_minutes || ' мин'
  END;

  -- Address label: "workplace, city, street" (skip empty parts)
  v_address_label := array_to_string(
    ARRAY(
      SELECT trim(x) FROM unnest(ARRAY[
        COALESCE(v_apt.m_workplace, ''),
        COALESCE(v_apt.m_city, ''),
        COALESCE(v_apt.m_address, '')
      ]) AS x
      WHERE trim(x) <> ''
    ),
    ', '
  );

  -- Look up master's custom template (subject + content)
  SELECT subject, content
  INTO v_template
  FROM message_templates
  WHERE master_id = v_apt.master_id
    AND kind = v_kind
    AND is_active = true
  LIMIT 1;

  -- Default texts (00096-format: rich 4/6/4-line bodies). Used when master
  -- has no custom template OR if their template fields are empty.
  IF event_type = 'created' THEN
    v_default_title := '📅 Вас записали на визит';
    v_default_body :=
      'Мастер: ' || v_apt.master_name || E'\n' ||
      'Услуга: ' || v_clean_service || E'\n' ||
      'Дата: ' || v_date_label || E'\n' ||
      'Время: ' || to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI') ||
      CASE WHEN v_price_label <> '' THEN E'\nСтоимость: ' || v_price_label ELSE '' END ||
      CASE WHEN v_duration_label <> '' THEN E'\nДлительность: ' || v_duration_label ELSE '' END;
  ELSIF event_type = 'cancelled' THEN
    v_default_title := '❌ Запись отменена';
    v_default_body :=
      'Мастер: ' || v_apt.master_name || E'\n' ||
      'Услуга: ' || v_clean_service || E'\n' ||
      'Дата: ' || v_date_label || E'\n' ||
      'Время: ' || to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');
  ELSIF event_type = 'rescheduled' THEN
    v_default_title := '🔄 Запись перенесена';
    v_default_body :=
      'Мастер: ' || v_apt.master_name || E'\n' ||
      'Услуга: ' || v_clean_service || E'\n' ||
      'Было: ' || v_old_date_label || ' ' || v_old_time_label || E'\n' ||
      'Стало: ' || v_date_label || ', ' || to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI');
  END IF;

  -- Pick body+subject: master's custom wins if non-empty, else default.
  v_title := COALESCE(NULLIF(v_template.subject, ''), v_default_title);
  v_body  := COALESCE(NULLIF(v_template.content, ''), v_default_body);

  -- Substitute placeholders. Defaults already have values inlined; this matters
  -- only when v_title/v_body came from a master-customized template.
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

  -- Dedupe: skip if same event already exists for this appointment in last 5 min.
  PERFORM 1 FROM notifications
  WHERE profile_id = v_apt.client_profile_id
    AND data->>'apt_id' = apt_id::text
    AND data->>'kind'   = 'booking_' || event_type
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
  RAISE WARNING 'dispatch_booking_notification(%, %): %', event_type, apt_id, SQLERRM;
END;
$$;
