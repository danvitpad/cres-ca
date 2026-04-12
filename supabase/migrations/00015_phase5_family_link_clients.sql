-- Phase 5.2 family bookings
-- The family_links table from 00005_family.sql was never applied to live DB (schema drift),
-- so this migration recreates it idempotently and adds the clients.family_link_id column
-- needed for "book on behalf of family member" flow.

CREATE TABLE IF NOT EXISTS family_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  relationship text NOT NULL DEFAULT 'child',
  linked_profile_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_links_parent ON family_links(parent_profile_id);

ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own family links" ON family_links;
CREATE POLICY "Users can manage own family links"
  ON family_links FOR ALL
  USING (parent_profile_id = auth.uid())
  WITH CHECK (parent_profile_id = auth.uid());

ALTER TABLE clients ADD COLUMN IF NOT EXISTS family_link_id uuid REFERENCES family_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_family_link ON clients(family_link_id);
