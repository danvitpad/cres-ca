-- Phase 7b: unread-aware notifications
-- Adds read_at column, in_app channel, UPDATE policy so users can mark their own as read.

ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'in_app';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(profile_id)
  WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Users can mark own notifications read" ON notifications;
CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
