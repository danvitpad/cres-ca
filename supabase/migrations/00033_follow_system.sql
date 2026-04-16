-- Add follow-back tracking to existing client_master_links
ALTER TABLE client_master_links
  ADD COLUMN IF NOT EXISTS master_follows_back boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS master_followed_back_at timestamptz;

-- Enable RLS (was OFF)
ALTER TABLE client_master_links ENABLE ROW LEVEL SECURITY;

-- Client reads own follows
CREATE POLICY "client_reads_own_links" ON client_master_links
  FOR SELECT USING (profile_id = auth.uid());

-- Master reads their followers
CREATE POLICY "master_reads_own_followers" ON client_master_links
  FOR SELECT USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

-- Client can follow
CREATE POLICY "client_can_follow" ON client_master_links
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Client can unfollow
CREATE POLICY "client_can_unfollow" ON client_master_links
  FOR DELETE USING (profile_id = auth.uid());

-- Master can follow-back (update their column)
CREATE POLICY "master_can_follow_back" ON client_master_links
  FOR UPDATE USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

-- Index for mutual queries
CREATE INDEX IF NOT EXISTS idx_cml_mutual
  ON client_master_links(master_id, master_follows_back) WHERE master_follows_back = true;
