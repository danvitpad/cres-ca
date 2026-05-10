/** --- YAML
 * name: Booking Lifecycle — Master-customizable Templates
 * description: Перезаписывает dispatch_booking_notification так, чтобы тексты для
 *              событий «запись подтверждена / перенесена / отменена» брались из
 *              message_templates мастера (kind = booking_confirmation /
 *              appointment_rescheduled / appointment_cancelled). Если кастомного
 *              шаблона нет — fallback на захардкоженный дефолт. Поддерживаемые
 *              переменные: {service_name}, {master_name}, {client_name}, {time},
 *              {old_time}, {price}, {address}, {confirm_url}.
 *              Триггеры trg_booking_created / trg_booking_updated не меняются —
 *              только тело helper-функции. Идемпотентно.
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
  v_price_label text;
  v_address_label text;
  v_clean_service text;
  v_currency_label text;
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
    a.id,
    a.starts_at,
    a.client_id,
    a.master_id,
    a.service_id,
    a.price       AS apt_price,
    a.currency    AS apt_currency,
    c.profile_id  AS client_profile_id,
    COALESCE(c.full_name, 'клиент')::text                          AS client_name,
    COALESCE(m.display_name, mp.full_name, 'мастер')::text         AS master_name,
    COALESCE(s.name, 'услуга')::text                               AS service_name,
    s.price        AS svc_price,
    s.currency     AS svc_currency,
    m.address      AS m_address,
    m.city         AS m_city,
    m.workplace_name AS m_workplace
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
  v_local_dt     := to_char(v_apt.starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI');
  v_old_local_dt := COALESCE(to_char(old_starts_at AT TIME ZONE 'Europe/Kyiv', 'DD.MM HH24:MI'), '');

  -- Strip "(индивид.)" decoration from service name (matches cron behavior)
  v_clean_service := regexp_replace(
    v_apt.service_name,
    '\s*\((индивид\.|индивидуально|индивидуальный|индивидуальная|individual)\)',
    '',
    'gi'
  );

  -- Currency symbol
  v_currency_label := CASE COALESCE(v_apt.apt_currency, v_apt.svc_currency, 'UAH')
    WHEN 'UAH' THEN '₴'
    WHEN 'USD' THEN '$'
    WHEN 'EUR' THEN '€'
    WHEN 'RUB' THEN '₽'
    WHEN 'PLN' THEN 'zł'
    WHEN 'GBP' THEN '£'
    ELSE COALESCE(v_apt.apt_currency, v_apt.svc_currency, 'UAH')
  END;

  -- Price label "1350 ₴" — empty string if no price
  v_price_label := CASE
    WHEN v_apt.apt_price IS NOT NULL AND v_apt.apt_price > 0 THEN
      CASE
        WHEN v_apt.apt_price = trunc(v_apt.apt_price) THEN trunc(v_apt.apt_price)::bigint::text
        ELSE trim(to_char(v_apt.apt_price, 'FM999999990.00'))
      END || ' ' || v_currency_label
    WHEN v_apt.svc_price IS NOT NULL AND v_apt.svc_price > 0 THEN
      CASE
        WHEN v_apt.svc_price = trunc(v_apt.svc_price) THEN trunc(v_apt.svc_price)::bigint::text
        ELSE trim(to_char(v_apt.svc_price, 'FM999999990.00'))
      END || ' ' || v_currency_label
    ELSE ''
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

  -- Default texts (used when no master template exists or after substitution)
  IF event_type = 'created' THEN
    v_default_title := 'Запись подтверждена';
    v_default_body  := 'Вы записаны к ' || v_apt.master_name || ' на ' || v_local_dt
                       || '. Услуга: ' || v_clean_service || '.';
  ELSIF event_type = 'cancelled' THEN
    v_default_title := 'Запись отменена';
    v_default_body  := 'Запись к ' || v_apt.master_name || ' на ' || v_local_dt || ' отменена.';
  ELSIF event_type = 'rescheduled' THEN
    v_default_title := 'Запись перенесена';
    v_default_body  := 'Запись к ' || v_apt.master_name
      || CASE WHEN v_old_local_dt <> '' THEN ' с ' || v_old_local_dt ELSE '' END
      || ' перенесена на ' || v_local_dt || '.';
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
  v_title := replace(v_title, '{old_time}',     v_old_local_dt);
  v_title := replace(v_title, '{price}',        v_price_label);
  v_title := replace(v_title, '{address}',      v_address_label);
  v_title := replace(v_title, '{confirm_url}',  v_baseurl || '/confirm/' || apt_id::text);

  v_body := replace(v_body, '{service_name}', v_clean_service);
  v_body := replace(v_body, '{master_name}',  v_apt.master_name);
  v_body := replace(v_body, '{client_name}',  v_apt.client_name);
  v_body := replace(v_body, '{time}',         v_local_dt);
  v_body := replace(v_body, '{old_time}',     v_old_local_dt);
  v_body := replace(v_body, '{price}',        v_price_label);
  v_body := replace(v_body, '{address}',      v_address_label);
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
