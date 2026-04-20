-- 00073_audit_fixes.sql  (consolidated — supersedes earlier 00073 + 00074)
--
-- Reality-audit fix pack 2026-04-20.
-- Idempotent: DROP POLICY IF EXISTS → CREATE. Safe to re-run.
--
-- What this fixes:
--   (A) day-1 bug: solo master had NO INSERT/UPDATE/DELETE on appointments
--       (initial schema 00001 only had SELECT; team-writes added in 00059/60)
--   (B) missing CRUD policies for payments / expenses / services / reviews
--   (C) defensive re-apply of 00068 RLS (service_categories / inventory_items /
--       suppliers / promo_codes etc.) that was reportedly applied partially
--   (D) solo-master display_name cleanup
--  
-- Column names verified against actual prod schema via REST probe on
-- 2026-04-20 (reviews has reviewer_id/target_id polymorphic shape,
-- service_materials has no master_id, inventory_usage has item_id).
--
-- Apply via Supabase Studio SQL Editor or `npx supabase db push`.


-- ============================================================================
-- 1. appointments — solo master full CRUD (day-1 gap)
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

DROP POLICY IF EXISTS "Clients insert own appointments" ON appointments;
CREATE POLICY "Clients insert own appointments" ON appointments
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 2. payments — joined via appointment_id → appointments.master_id
-- (prod payments table has ONLY appointment_id, no direct master_id/client_id)
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own payments" ON payments;
CREATE POLICY "Masters manage own payments" ON payments
  FOR ALL USING (
    appointment_id IN (
      SELECT id FROM appointments
      WHERE master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    )
  ) WITH CHECK (
    appointment_id IN (
      SELECT id FROM appointments
      WHERE master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    )
  );


-- ============================================================================
-- 3. expenses — master manages own
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
-- 4. services — master manages own
-- ============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own services" ON services;
CREATE POLICY "Masters manage own services" ON services
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 5. reviews — polymorphic (reviewer_id + target_id/target_type).
-- Reviewer writes own reviews; anyone reads published; master reads own inbox.
-- ============================================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviewers write own reviews" ON reviews;
CREATE POLICY "Reviewers write own reviews" ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
  );

DROP POLICY IF EXISTS "Reviewers update own reviews" ON reviews;
CREATE POLICY "Reviewers update own reviews" ON reviews
  FOR UPDATE USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Reviewers delete own reviews" ON reviews;
CREATE POLICY "Reviewers delete own reviews" ON reviews
  FOR DELETE USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Public reads published reviews" ON reviews;
CREATE POLICY "Public reads published reviews" ON reviews
  FOR SELECT USING (is_published = true);


-- ============================================================================
-- 6. service_categories — defensive re-apply (INSERT was 403)
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
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters delete own service_categories" ON service_categories;
CREATE POLICY "Masters delete own service_categories" ON service_categories
  FOR DELETE USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 7. inventory_items — master owns. inventory_usage joined via item_id.
-- ============================================================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own inventory_items" ON inventory_items;
CREATE POLICY "Masters manage own inventory_items" ON inventory_items
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );

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
-- 8. suppliers — master manages own
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
-- 9. promo_codes — ensure column + RLS
-- ============================================================================
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS applicable_service_ids UUID[] DEFAULT '{}'::UUID[];

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters manage own promo codes" ON promo_codes;
CREATE POLICY "Masters manage own promo codes" ON promo_codes
  FOR ALL USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read active promo codes" ON promo_codes;
CREATE POLICY "Authenticated users can read active promo codes" ON promo_codes
  FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');


-- ============================================================================
-- 10. service_materials — scoped via service_id → services.master_id
--     (service_materials has NO direct master_id — verified 2026-04-20)
-- ============================================================================
ALTER TABLE service_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage service_materials for own services" ON service_materials;
CREATE POLICY "Masters manage service_materials for own services" ON service_materials
  FOR ALL USING (
    service_id IN (
      SELECT id FROM services
      WHERE master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    )
  ) WITH CHECK (
    service_id IN (
      SELECT id FROM services
      WHERE master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
    )
  );


-- ============================================================================
-- 11. material_transactions — has master_id
-- ============================================================================
ALTER TABLE material_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own material_transactions" ON material_transactions;
CREATE POLICY "Masters manage own material_transactions" ON material_transactions
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 12. supplier_orders — has master_id
-- ============================================================================
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters manage own supplier_orders" ON supplier_orders;
CREATE POLICY "Masters manage own supplier_orders" ON supplier_orders
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );


-- ============================================================================
-- 13. manual_incomes — master manages own (phase 1 RLS that was missing)
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
-- 14. DATA CLEANUP: normalize display_name for solo masters.
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
-- Tell PostgREST to reload its schema cache so new policies + column
-- additions propagate to the REST layer immediately.
  -- ============================================================================
  NOTIFY pgrst, 'reload schema';
