-- --- YAML
-- name: pg_cron_schedules
-- description: Migrate all 18 cron jobs from Vercel (limited to 2 daily on Hobby) to Supabase pg_cron. voice-reminders runs every minute for precise reminder delivery. CRON_SECRET stored in vault.
-- created: 2026-04-17
-- ---

-- 1. Enable pg_cron + pg_net extensions (free on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Store CRON_SECRET in vault (generated randomly)
-- Production value generated once; do not re-run or it will duplicate.
-- To rotate: DELETE FROM vault.secrets WHERE name = 'cron_secret'; then re-run this DO block.
DO $$
DECLARE
  v_exists int;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM vault.secrets WHERE name = 'cron_secret';
  IF v_exists = 0 THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'cron_secret',
      'CRON_SECRET for Vercel cron endpoints'
    );
  END IF;
END $$;

-- 3. Function that calls Vercel endpoints with Authorization header
CREATE OR REPLACE FUNCTION public.call_vercel_cron(p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  v_url := 'https://cres-ca.vercel.app' || p_path;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;

  PERFORM net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 10000
  );
END;
$$;

-- 4. Schedules — all 18 cron jobs (most daily, voice-reminders every minute)
-- Note: pg_cron uses UTC. Times are shifted so they approximate the intended Kyiv times.
SELECT cron.schedule('voice-reminders-minute',  '* * * * *',  $$SELECT public.call_vercel_cron('/api/cron/voice-reminders')$$);
SELECT cron.schedule('birthdays-daily',         '0 6 * * *',  $$SELECT public.call_vercel_cron('/api/cron/birthdays')$$);
SELECT cron.schedule('reminders-daily',         '0 5 * * *',  $$SELECT public.call_vercel_cron('/api/cron/reminders')$$);
SELECT cron.schedule('reviews-daily',           '0 7 * * *',  $$SELECT public.call_vercel_cron('/api/cron/reviews')$$);
SELECT cron.schedule('burning-slots-daily',     '0 15 * * *', $$SELECT public.call_vercel_cron('/api/cron/burning-slots')$$);
SELECT cron.schedule('fx-daily',                '0 4 * * *',  $$SELECT public.call_vercel_cron('/api/cron/fx')$$);
SELECT cron.schedule('cadence-daily',           '0 8 * * *',  $$SELECT public.call_vercel_cron('/api/cron/cadence')$$);
SELECT cron.schedule('subscriptions-daily',     '0 3 * * *',  $$SELECT public.call_vercel_cron('/api/cron/subscriptions')$$);
SELECT cron.schedule('winback-weekly',          '0 9 * * 1',  $$SELECT public.call_vercel_cron('/api/cron/winback')$$);
SELECT cron.schedule('nps-daily',               '0 10 * * *', $$SELECT public.call_vercel_cron('/api/cron/nps')$$);
SELECT cron.schedule('notifications-daily',     '30 5 * * *', $$SELECT public.call_vercel_cron('/api/cron/notifications')$$);
SELECT cron.schedule('recommendations-daily',   '0 12 * * *', $$SELECT public.call_vercel_cron('/api/cron/recommendations')$$);
SELECT cron.schedule('purge-clients-daily',     '0 0 * * *',  $$SELECT public.call_vercel_cron('/api/cron/purge-clients')$$);
SELECT cron.schedule('badges-daily',            '0 1 * * *',  $$SELECT public.call_vercel_cron('/api/cron/badges')$$);
SELECT cron.schedule('daily-closeout-daily',    '0 19 * * *', $$SELECT public.call_vercel_cron('/api/cron/daily-closeout')$$);
SELECT cron.schedule('debts-weekly',            '0 11 * * 1', $$SELECT public.call_vercel_cron('/api/cron/debts')$$);
SELECT cron.schedule('low-stock-daily',         '0 2 * * *',  $$SELECT public.call_vercel_cron('/api/cron/low-stock')$$);
SELECT cron.schedule('post-visit-upsell-daily', '0 11 * * *', $$SELECT public.call_vercel_cron('/api/cron/post-visit-upsell')$$);
