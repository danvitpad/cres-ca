-- 00067_manual_incomes.sql
-- Manual income entries recorded from the master Mini App FAB flow.
-- Separate from `appointments`.completed revenue (which stays the primary source for all KPIs)
-- and distinct from `expenses` (positive-only).

CREATE TABLE IF NOT EXISTS manual_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'UAH',
  date date NOT NULL DEFAULT current_date,
  client_name text,
  service_name text,
  payment_method text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_incomes_master_date ON manual_incomes(master_id, date);

ALTER TABLE manual_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters manage own manual_incomes" ON manual_incomes
  FOR ALL USING (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  ) WITH CHECK (
    master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid())
  );
