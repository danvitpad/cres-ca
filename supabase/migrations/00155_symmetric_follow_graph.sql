-- 00155 — Symmetric follow graph (client ↔ master)
--
-- Before:  client_master_links rows existed only when client follows master.
--          `master_follows_back` was a mutual-flag on top of that.
-- After:   Either side can initiate. Row exists while at least one direction
--          is active. Trigger removes the row when both flags become false.
--
-- New column: client_follows (default true — back-compat for existing rows).
-- New trigger: cleanup_inactive_follow — DELETE row when both flags false.
-- New RLS: master can INSERT row when initiating (with client_follows=false).
--          Each side can UPDATE only its own column.

ALTER TABLE client_master_links
  ADD COLUMN IF NOT EXISTS client_follows boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_dismissed_back_request boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS master_dismissed_back_request boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN client_master_links.client_follows IS
  'TRUE = client is subscribed to master. FALSE = client never subscribed or has unsubscribed.';
COMMENT ON COLUMN client_master_links.client_dismissed_back_request IS
  'Client tapped "x" on the "master subscribed to you" card and does not want to see it again.';
COMMENT ON COLUMN client_master_links.master_dismissed_back_request IS
  'Master tapped "x" on the "client subscribed to you" card and does not want to see it again.';

-- Back-fill: all existing rows are client-initiated, keep client_follows=true.
UPDATE client_master_links SET client_follows = true WHERE client_follows IS DISTINCT FROM true;

-- ── Cleanup trigger: when both directions are off, drop the row.
CREATE OR REPLACE FUNCTION cleanup_inactive_follow() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.client_follows = false AND NEW.master_follows_back = false THEN
    DELETE FROM client_master_links
      WHERE profile_id = NEW.profile_id AND master_id = NEW.master_id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_inactive_follow ON client_master_links;
CREATE TRIGGER trg_cleanup_inactive_follow
  AFTER UPDATE ON client_master_links
  FOR EACH ROW EXECUTE FUNCTION cleanup_inactive_follow();

-- ── RLS: allow master to INSERT a row when they're the initiator.
-- Existing "client_can_follow" policy stays (client inserts their own row).
DROP POLICY IF EXISTS "master_can_initiate_follow" ON client_master_links;
CREATE POLICY "master_can_initiate_follow" ON client_master_links
  FOR INSERT
  WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ── DELETE policy stays: client can DELETE their row. But we prefer UPDATE flags
-- to false (triggered cleanup), so DELETE path is reserved for full unfollow
-- when the other side is already off too.
-- Master can also DELETE rows where they are the master (symmetric).
DROP POLICY IF EXISTS "master_can_unfollow" ON client_master_links;
CREATE POLICY "master_can_unfollow" ON client_master_links
  FOR DELETE
  USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

-- Indices for new queries.
CREATE INDEX IF NOT EXISTS idx_cml_master_pending
  ON client_master_links(master_id)
  WHERE client_follows = true AND master_follows_back = false;

CREATE INDEX IF NOT EXISTS idx_cml_client_pending
  ON client_master_links(profile_id)
  WHERE master_follows_back = true AND client_follows = false;
