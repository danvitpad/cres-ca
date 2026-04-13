-- Phase 7: let clients see master→master recommendations addressed to them.
-- Previously only masters could read via `to_master_id`; clients need visibility
-- so we can surface "Your nail master suggests this massage therapist" on /feed.

DROP POLICY IF EXISTS "Clients view recommendations addressed to them" ON master_recommendations;
CREATE POLICY "Clients view recommendations addressed to them"
  ON master_recommendations FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));
