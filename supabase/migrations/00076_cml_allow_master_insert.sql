-- 00076_cml_allow_master_insert.sql
-- Bug: UI calendar "Подтвердить" → POST /rest/v1/appointments returned 403
-- with error "new row violates RLS policy for table client_master_links".
--
-- Root cause: there's a trigger (on appointments? or some rule?) that
-- INSERTs into client_master_links when a master creates an appointment
-- for a client. The existing CML RLS INSERT policy from migration 00033
-- only allows clients (profile_id = auth.uid()). Master-side INSERT had
-- no permissive policy → violation → cascading 403 on the whole
-- appointment INSERT.
--
-- Fix: add a second (permissive) INSERT policy so masters can link
-- themselves to their own clients:
--
--   "Masters can link own clients" — permits INSERT if the CML row's
--   master_id is the caller's master record AND profile_id is a
--   profile of a client already owned by that master.

DROP POLICY IF EXISTS "Masters can link own clients" ON client_master_links;

CREATE POLICY "Masters can link own clients" ON client_master_links
  FOR INSERT WITH CHECK (
    -- Caller is the master of the row
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    AND
    -- The client-profile being linked is already a client of that master
    profile_id IN (
      SELECT c.profile_id
        FROM clients c
        JOIN masters m ON m.id = c.master_id
       WHERE c.master_id = client_master_links.master_id
         AND m.profile_id = auth.uid()
         AND c.profile_id IS NOT NULL
    )
  );

-- Also: give masters UPSERT-via-ON-CONFLICT ability by also granting UPDATE
-- on rows that reference their master_id (so ON CONFLICT DO NOTHING works):
DROP POLICY IF EXISTS "Masters can update own CML rows" ON client_master_links;
CREATE POLICY "Masters can update own CML rows" ON client_master_links
  FOR UPDATE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
