-- Migration: register waitlist-fill cron (every 5 min via pg_cron)
-- P4.2: Auto-fill cancellation → waitlist blast
-- Runs every 5 minutes. Finds recently-cancelled future appointments
-- and pushes Telegram notifications to waiting clients.
-- Idempotent: unschedule first if exists, then schedule.

SELECT cron.unschedule('waitlist-fill-5min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'waitlist-fill-5min'
);

SELECT cron.schedule(
  'waitlist-fill-5min',
  '*/5 * * * *',
  $$SELECT public.call_vercel_cron('/api/cron/waitlist-fill')$$
);
