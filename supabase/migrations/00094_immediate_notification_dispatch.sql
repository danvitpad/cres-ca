/** --- YAML
 * name: Immediate Notification Dispatch via pg_net
 * description: Vercel Hobby permits only daily cron jobs, so notifications were sitting
 *              hours in 'pending' status. This migration: enables pg_net, adds AFTER INSERT
 *              trigger on notifications that calls /api/cron/notifications endpoint
 *              (which the daily cron already calls) — but immediately, async, via pg_net.
 *              Result: notifications deliver within seconds, not hours.
 *
 *              REQUIRES: after applying, set the cron secret as DB setting:
 *              ALTER DATABASE postgres SET app.cron_secret = '<value of CRON_SECRET env var>';
 *              ALTER DATABASE postgres SET app.url = 'https://cres-ca.com';
 *              SELECT pg_reload_conf();
 *
 * created: 2026-04-25
 * --- */

-- 1. Enable pg_net (HTTP requests from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Helper: read app settings (URL + cron secret) with safe fallback
CREATE OR REPLACE FUNCTION public.app_setting(key text, fallback text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v text;
BEGIN
  v := current_setting('app.' || key, true);
  IF v IS NULL OR v = '' THEN RETURN fallback; END IF;
  RETURN v;
END;
$$;

-- 3. Trigger function: when a pending notification is inserted, fire off
--    an async HTTP call to the cron-notifications endpoint, which will
--    pick it up (and any other pending) and deliver via TG/email.
CREATE OR REPLACE FUNCTION public.trg_notification_dispatch_immediate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  -- Only auto-dispatch pending TG/email notifications scheduled for now or earlier
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  IF NEW.channel NOT IN ('telegram', 'email', 'push', 'in_app') THEN RETURN NEW; END IF;
  IF NEW.scheduled_for IS NOT NULL AND NEW.scheduled_for > now() + interval '1 minute' THEN
    RETURN NEW;  -- future-scheduled (e.g. reminder N hours before) — leave for cron
  END IF;

  v_url := public.app_setting('url', 'https://cres-ca.com');
  v_secret := public.app_setting('cron_secret');

  IF v_secret IS NULL THEN
    RAISE WARNING '[notify-dispatch] app.cron_secret not set — notification % will wait for daily cron', NEW.id;
    RETURN NEW;
  END IF;

  -- Async HTTP GET — pg_net returns request_id immediately, executes in background
  PERFORM net.http_get(
    url := v_url || '/api/cron/notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER block the notification insert because of dispatch failure
  RAISE WARNING '[notify-dispatch] failed for notification %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_dispatch_immediate ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_immediate
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_notification_dispatch_immediate();
