-- 00068_phase1_rls_fixes.sql
-- Phase 1A: backfill RLS policies for tables that had RLS enabled but 0 policies
-- (inventory_items, inventory_usage, equipment, waitlist, ai_briefs).
-- Also fixes service_categories (INSERT/UPDATE/DELETE for master-owned rows) and
-- adds promo_codes.applicable_service_ids column used by marketing/deals UI.

-- -----------------------------------------------------------------------------
-- 1. inventory_items — owner (master via profile_id)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Masters manage own inventory_items" ON inventory_items;
CREATE POLICY "Masters manage own inventory_items" ON inventory_items
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. inventory_usage — owner via JOIN on inventory_items
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Masters manage own inventory_usage" ON inventory_usage;
CREATE POLICY "Masters manage own inventory_usage" ON inventory_usage
  FOR ALL USING (
    item_id IN (
      SELECT id FROM inventory_items
      WHERE master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    )
  ) WITH CHECK (
    item_id IN (
      SELECT id FROM inventory_items
      WHERE master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 3. equipment — salon members (admin/master/receptionist) via salon_members
-- Solo masters currently blocked (salon_id NOT NULL) — will be revisited in
-- Phase 11B when solo flow is wired.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Salon members manage equipment" ON equipment;
CREATE POLICY "Salon members manage equipment" ON equipment
  FOR ALL USING (
    salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active'
    )
  ) WITH CHECK (
    salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 4. waitlist — master owner (full CRUD) + client view-own
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Masters manage own waitlist" ON waitlist;
CREATE POLICY "Masters manage own waitlist" ON waitlist
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clients view own waitlist" ON waitlist;
CREATE POLICY "Clients view own waitlist" ON waitlist
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 5. ai_briefs — master owner (SELECT/UPDATE/DELETE). INSERT is service-role
-- only (cron-generated) so no INSERT policy for anon/auth.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Masters read own ai_briefs" ON ai_briefs;
CREATE POLICY "Masters read own ai_briefs" ON ai_briefs
  FOR SELECT USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters update own ai_briefs" ON ai_briefs;
CREATE POLICY "Masters update own ai_briefs" ON ai_briefs
  FOR UPDATE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters delete own ai_briefs" ON ai_briefs;
CREATE POLICY "Masters delete own ai_briefs" ON ai_briefs
  FOR DELETE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 6. service_categories — keep SELECT public (existing), add INSERT/UPDATE/
-- DELETE for master-owned rows. Global categories (master_id IS NULL AND
-- salon_id IS NULL) stay seed-only (no auth.uid can own them).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Masters insert own service_categories" ON service_categories;
CREATE POLICY "Masters insert own service_categories" ON service_categories
  FOR INSERT WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active' AND role IN ('admin', 'master', 'receptionist')
    )
  );

DROP POLICY IF EXISTS "Masters update own service_categories" ON service_categories;
CREATE POLICY "Masters update own service_categories" ON service_categories
  FOR UPDATE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active' AND role IN ('admin', 'master', 'receptionist')
    )
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active' AND role IN ('admin', 'master', 'receptionist')
    )
  );

DROP POLICY IF EXISTS "Masters delete own service_categories" ON service_categories;
CREATE POLICY "Masters delete own service_categories" ON service_categories
  FOR DELETE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active' AND role IN ('admin', 'master', 'receptionist')
    )
  );

-- -----------------------------------------------------------------------------
-- 7. promo_codes — add applicable_service_ids column (referenced by
-- marketing/deals UI). Empty array = applies to all services.
-- -----------------------------------------------------------------------------
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS applicable_service_ids UUID[] DEFAULT '{}'::UUID[];
