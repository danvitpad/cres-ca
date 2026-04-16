-- Allow authenticated users to insert notifications for any profile
-- Needed for: follow system (notify target when someone follows them)
-- Security: SELECT policy ensures users can only READ their own notifications
CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);
