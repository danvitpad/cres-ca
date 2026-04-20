-- 00073_audit_fixes.sql
-- Reality-audit fixes (2026-04-20):
-- Defensive re-apply of RLS policies that returned 403/400 for authenticated
-- masters despite migration 00068 marking them "applied". Root cause likely:
-- 00068 ran partially, some DROP+CREATE blocks silently swallowed. This
-- migration is fully idempotent (DROP IF EXISTS → CREATE) and can be re-run
-- safely.

-- ============================================================================
-- 1. inventory_items — masters must manage own rows (INSERT was 403)
-- ============================================================================
DROP POLICY IF EXISTS "Masters manage own inventory_items" ON inventory_items;
CREATE POLICY "Masters manage own inventory_items" ON inventory_items
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 2. service_categories — masters must INSERT/UPDATE/DELETE own (INSERT was 403)
-- ============================================================================
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads service_categories" ON service_categories;
CREATE POLICY "Anyone reads service_categories" ON service_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Masters insert own service_categories" ON service_categories;
CREATE POLICY "Masters insert own service_categories" ON service_categories
  FOR INSERT WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'master', 'receptionist')
    )
  );

DROP POLICY IF EXISTS "Masters update own service_categories" ON service_categories;
CREATE POLICY "Masters update own service_categories" ON service_categories
  FOR UPDATE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'master', 'receptionist')
    )
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'master', 'receptionist')
    )
  );

DROP POLICY IF EXISTS "Masters delete own service_categories" ON service_categories;
CREATE POLICY "Masters delete own service_categories" ON service_categories
  FOR DELETE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    OR salon_id IN (
      SELECT salon_id FROM salon_members
      WHERE profile_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'master', 'receptionist')
    )
  );

-- ============================================================================
-- 3. suppliers — masters manage own (INSERT returned 400 in audit screenshots)
-- ============================================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own suppliers" ON suppliers;
CREATE POLICY "Masters manage own suppliers" ON suppliers
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 4. promo_codes — ensure column + RLS stay intact
-- ============================================================================
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS applicable_service_ids UUID[] DEFAULT '{}'::UUID[];

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own promo codes" ON promo_codes;
CREATE POLICY "Masters manage own promo codes"
  ON promo_codes FOR ALL
  USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read active promo codes" ON promo_codes;
CREATE POLICY "Authenticated users can read active promo codes"
  ON promo_codes FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- ============================================================================
-- 5. service_materials / material_transactions / supplier_orders (Phase 2)
-- Ensure RLS policies exist for the materials → services linking
-- ============================================================================
ALTER TABLE service_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own service_materials" ON service_materials;
CREATE POLICY "Masters manage own service_materials" ON service_materials
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

ALTER TABLE material_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own material_transactions" ON material_transactions;
CREATE POLICY "Masters manage own material_transactions" ON material_transactions
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own supplier_orders" ON supplier_orders;
CREATE POLICY "Masters manage own supplier_orders" ON supplier_orders
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- 6. inventory_usage — masters access via inventory_items JOIN
-- ============================================================================
ALTER TABLE inventory_usage ENABLE ROW LEVEL SECURITY;
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

-- ============================================================================
-- 7. DATA CLEANUP: normalize master.display_name for solo masters
-- Solo master (salon_id IS NULL) whose display_name matches a salon-like brand
-- (different from profile.full_name) → reset display_name to profile.full_name
-- so the UI fallback chain (profile.full_name OR display_name) shows the
-- personal name consistently.
-- ============================================================================
UPDATE masters m
SET display_name = p.full_name
FROM profiles p
WHERE m.profile_id = p.id
  AND m.salon_id IS NULL
  AND p.full_name IS NOT NULL
  AND p.full_name <> ''
  AND (m.display_name IS NULL OR m.display_name <> p.full_name);

-- ============================================================================
-- 8. manual_incomes RLS — feature shipped in 00067, re-assert policy
-- ============================================================================
ALTER TABLE manual_incomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own manual_incomes" ON manual_incomes;
CREATE POLICY "Masters manage own manual_incomes" ON manual_incomes
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

-- ============================================================================
-- Postgres RLS note: after this migration, ask PostgREST to reload schema
-- cache (it auto-reloads on DDL, but explicit NOTIFY is safer):
-- ============================================================================
NOTIFY pgrst, 'reload schema';
