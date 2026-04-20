-- 00077_appointment_reminders_prefs.sql
-- Client-customizable appointment reminders.
--
-- Before: hard-coded 24h + 2h reminders in /api/cron/reminders for ALL clients.
-- After: each profile stores an array of {value, unit} pairs. When an
-- appointment is created, reminder rows are inserted into notifications
-- with scheduled_for = starts_at - offset. pg_cron fires
-- /api/cron/notifications every minute so reminders land on time.

-- 1. Column on profiles — default is the old hard-coded [24h, 2h] pair.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS appointment_reminders_prefs jsonb
  DEFAULT '[{"value":1,"unit":"days"},{"value":2,"unit":"hours"}]'::jsonb;

-- Keep existing rows consistent (default only applies to new INSERTs).
UPDATE profiles
SET appointment_reminders_prefs = '[{"value":1,"unit":"days"},{"value":2,"unit":"hours"}]'::jsonb
WHERE appointment_reminders_prefs IS NULL;

-- 2. pg_cron: add per-minute notifications dispatcher (was daily only —
-- appointment reminders couldn't land with minute precision).
-- Idempotent: unschedule previous name if present before adding.
DO $$
BEGIN
  PERFORM cron.unschedule('notifications-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notifications-minute',
  '* * * * *',
  $$SELECT public.call_vercel_cron('/api/cron/notifications')$$
);

-- Keep the old daily schedule as safety net too — it's a no-op when the
-- minute cron already delivered everything pending.

NOTIFY pgrst, 'reload schema';
