/** --- YAML
 * name: Direct notification dispatch via pg_net (full rebuild)
 * description: Полностью убирает зависимость от Vercel cron для доставки уведомлений.
 *              pg_cron каждую минуту вызывает функцию которая шлёт pending notifications
 *              напрямую в Telegram через pg_net. Триггер на INSERT тоже шлёт сразу.
 *              REQUIRES: токен бота в vault — см. setup ниже.
 *
 *              SETUP (сделать ОДИН раз в Supabase Studio после применения миграции):
 *              1) В Project Settings → Vault → Secrets → New Secret:
 *                 name = telegram_bot_token
 *                 value = <значение TELEGRAM_BOT_TOKEN из Vercel env>
 *
 * created: 2026-04-25
 * --- */

-- 1. Drop old vercel-relay trigger from 00094 (replaced by direct dispatch)
DROP TRIGGER IF EXISTS trg_notifications_dispatch_immediate ON public.notifications;
DROP FUNCTION IF EXISTS public.trg_notification_dispatch_immediate();

-- 2. Ensure pg_net is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Helper: read telegram bot token from vault
CREATE OR REPLACE FUNCTION public.get_tg_bot_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name IN ('telegram_bot_token', 'TELEGRAM_BOT_TOKEN', 'tg_bot_token', 'TG_BOT_TOKEN')
  ORDER BY CASE name
    WHEN 'telegram_bot_token' THEN 1
    WHEN 'TELEGRAM_BOT_TOKEN' THEN 2
    WHEN 'tg_bot_token' THEN 3
    WHEN 'TG_BOT_TOKEN' THEN 4
  END
  LIMIT 1;
  RETURN v_token;
END;
$$;

-- 4. Send a single notification directly via Telegram API (synchronous from caller's perspective)
CREATE OR REPLACE FUNCTION public.send_notification_via_pg_net(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_token text;
  v_n record;
  v_text text;
  v_app_url text;
  v_request_id bigint;
BEGIN
  v_token := public.get_tg_bot_token();
  IF v_token IS NULL OR v_token = '' THEN
    UPDATE public.notifications
    SET status = 'failed',
        data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('error', 'no_telegram_bot_token_in_vault')
    WHERE id = p_notification_id;
    RETURN;
  END IF;

  v_app_url := 'https://cres-ca.com';

  -- Load notification + recipient telegram_id
  SELECT n.id, n.title, n.body, n.channel, n.status, p.telegram_id::text AS telegram_id
  INTO v_n
  FROM public.notifications n
  LEFT JOIN public.profiles p ON p.id = n.profile_id
  WHERE n.id = p_notification_id;

  IF NOT FOUND OR v_n.status <> 'pending' THEN
    RETURN;
  END IF;

  IF v_n.channel <> 'telegram' THEN
    -- Only TG dispatch implemented here; email/push handled by Vercel daily cron
    RETURN;
  END IF;

  IF v_n.telegram_id IS NULL OR v_n.telegram_id = '' THEN
    UPDATE public.notifications
    SET status = 'failed',
        data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('error', 'no_telegram_id')
    WHERE id = p_notification_id;
    RETURN;
  END IF;

  v_text := '<b>' || COALESCE(v_n.title, '') || '</b>' || E'\n\n' || COALESCE(v_n.body, '');

  -- Async fire — pg_net queues the request, response handled in background
  SELECT net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_n.telegram_id,
      'text', v_text,
      'parse_mode', 'HTML',
      'disable_web_page_preview', true,
      'reply_markup', jsonb_build_object(
        'inline_keyboard', jsonb_build_array(jsonb_build_array(
          jsonb_build_object('text', '✨ CRES-CA', 'web_app', jsonb_build_object('url', v_app_url || '/telegram'))
        ))
      )
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 8000
  ) INTO v_request_id;

  UPDATE public.notifications
  SET status = 'sent',
      sent_at = now(),
      data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('pg_net_request_id', v_request_id)
  WHERE id = p_notification_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE public.notifications
  SET status = 'failed',
      data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('error', SQLERRM)
  WHERE id = p_notification_id;
END;
$$;

-- 5. Bulk dispatcher: process all pending TG notifications scheduled for now
CREATE OR REPLACE FUNCTION public.dispatch_pending_notifications()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  cnt int := 0;
BEGIN
  FOR rec IN
    SELECT id FROM public.notifications
    WHERE status = 'pending'
      AND channel = 'telegram'
      AND (scheduled_for IS NULL OR scheduled_for <= now())
    ORDER BY scheduled_for NULLS FIRST, created_at
    LIMIT 100
  LOOP
    PERFORM public.send_notification_via_pg_net(rec.id);
    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$;

-- 6. Replace pg_cron schedule: run every minute (was every 5 min via Vercel relay)
DO $$ BEGIN
  PERFORM cron.unschedule('notifications-every-5-min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('notifications-direct-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notifications-direct-every-minute',
  '* * * * *',
  $$SELECT public.dispatch_pending_notifications()$$
);

-- 7. Trigger AFTER INSERT — dispatch immediately for due notifications
CREATE OR REPLACE FUNCTION public.trg_notification_dispatch_now()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.channel = 'telegram'
     AND (NEW.scheduled_for IS NULL OR NEW.scheduled_for <= now() + interval '30 seconds')
  THEN
    PERFORM public.send_notification_via_pg_net(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify-trigger] %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_dispatch_now ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_now
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_notification_dispatch_now();
