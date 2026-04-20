-- 00074_solo_master_write_rls.sql
-- CRITICAL fix: solo master (salon_id IS NULL) had NO INSERT/UPDATE/DELETE
-- policy on appointments. Initial schema only created SELECT policy.
-- Team receptionist/admin got write access via 00059/00060, but solo
-- masters have been silently broken — any attempt to add an appointment
-- from /calendar returned 403 Forbidden.
--
-- Same audit: clients already has FOR ALL via 00001; appointments did not.
-- Also ensures manual_incomes / expenses / payments write policies are
-- explicit for solo master. Idempotent (DROP IF EXISTS + CREATE).
--
-- Apply via: npx supabase db push OR Supabase Studio SQL Editor.

-- ============================================================================
-- 1. appointments — solo master full CRUD on their own
-- ============================================================================
DROP POLICY IF EXISTS "Masters insert own appointments" ON appointments;
CREATE POLICY "Masters insert own appointments" ON appointments
  FOR INSERT WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters update own appointments" ON appointments;
CREATE POLICY "Masters update own appointments" ON appointments
  FOR UPDATE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters delete own appointments" ON appointments;
CREATE POLICY "Masters delete own appointments" ON appointments
  FOR DELETE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 2. Clients can insert their OWN appointment (booking flow)
-- ============================================================================
DROP POLICY IF EXISTS "Clients insert own appointments" ON appointments;
CREATE POLICY "Clients insert own appointments" ON appointments
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 3. payments — solo master manages own
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own payments" ON payments;
CREATE POLICY "Masters manage own payments" ON payments
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 4. expenses — solo master manages own (manual_incomes covered in 00073)
-- ============================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own expenses" ON expenses;
CREATE POLICY "Masters manage own expenses" ON expenses
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 5. services — solo master full CRUD (SELECT already public)
-- ============================================================================
DROP POLICY IF EXISTS "Masters manage own services" ON services;
CREATE POLICY "Masters manage own services" ON services
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 6. reviews — participants manage their own
-- ============================================================================
DROP POLICY IF EXISTS "Reviewers manage own reviews" ON reviews;
CREATE POLICY "Reviewers manage own reviews" ON reviews
  FOR ALL USING (
    reviewer_profile_id = auth.uid()
  ) WITH CHECK (
    reviewer_profile_id = auth.uid()
  );

-- ============================================================================
-- Note: client_master_links INSERT is intentionally client-only (00033).
-- Trigger sync_follow_to_cml (SECURITY DEFINER) handles the master-side
-- case. If front-end still hits INSERT directly — code bug, not RLS.
-- ============================================================================

NOTIFY pgrst, 'reload schema';
