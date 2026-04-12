-- Phase 5.3 + 5.4 — cross-master recommendations and master guild network

-- 5.3 master_recommendations
CREATE TABLE IF NOT EXISTS master_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  to_master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  bonus_points int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  booked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_master_rec_from ON master_recommendations(from_master_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_rec_to ON master_recommendations(to_master_id, created_at DESC);

ALTER TABLE master_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own sent recommendations" ON master_recommendations;
CREATE POLICY "Masters manage own sent recommendations"
  ON master_recommendations FOR ALL
  USING (from_master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()))
  WITH CHECK (from_master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Masters view received recommendations" ON master_recommendations;
CREATE POLICY "Masters view received recommendations"
  ON master_recommendations FOR SELECT
  USING (to_master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

ALTER TABLE masters ADD COLUMN IF NOT EXISTS bonus_points int NOT NULL DEFAULT 0;

-- 5.4 master_follows (guild network — lightweight follow model)
CREATE TABLE IF NOT EXISTS master_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  to_master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_master_id, to_master_id)
);
CREATE INDEX IF NOT EXISTS idx_master_follows_from ON master_follows(from_master_id);
CREATE INDEX IF NOT EXISTS idx_master_follows_to ON master_follows(to_master_id);

ALTER TABLE master_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own follows" ON master_follows;
CREATE POLICY "Masters manage own follows"
  ON master_follows FOR ALL
  USING (from_master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()))
  WITH CHECK (from_master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone authenticated can view follows" ON master_follows;
CREATE POLICY "Anyone authenticated can view follows"
  ON master_follows FOR SELECT TO authenticated USING (true);
