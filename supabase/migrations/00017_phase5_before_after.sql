-- Phase 5.1 Before/After photos
-- Мастер загружает пары до/после, клиент видит на /masters/[id] свайпер-слайдер.

CREATE TABLE IF NOT EXISTS before_after_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  before_url text NOT NULL,
  after_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_before_after_master ON before_after_photos(master_id, created_at DESC);

ALTER TABLE before_after_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view before-after photos" ON before_after_photos;
CREATE POLICY "Anyone can view before-after photos"
  ON before_after_photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Masters manage own before-after" ON before_after_photos;
CREATE POLICY "Masters manage own before-after"
  ON before_after_photos FOR ALL
  USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));
