-- Allow authenticated users to read basic profile info of others
-- Needed for: global search, follow system, follower lists
CREATE POLICY "Authenticated can read profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);
