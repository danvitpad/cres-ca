-- Phase 1.6: add dismissed_at for notifications cleanup
-- Dismissed notifications are hidden from UI but retained for history/audit.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_profile_undismissed
  ON public.notifications (profile_id, created_at DESC)
  WHERE dismissed_at IS NULL;

COMMENT ON COLUMN public.notifications.dismissed_at IS
  'Phase 1.6: set when user dismisses (X) the notification; dismissed rows are filtered out of UI queries.';
