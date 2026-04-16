-- Promo codes / deals table for marketing/deals page
-- Supports percentage and fixed discounts, usage limits, date ranges, and service targeting

CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses int,
  uses_count int NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  applicable_service_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(master_id, code)
);

CREATE INDEX idx_promo_codes_master ON promo_codes(master_id);

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage own promo codes"
  ON promo_codes FOR ALL
  USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()))
  WITH CHECK (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));

-- Clients can read active promo codes (for applying at booking)
CREATE POLICY "Authenticated users can read active promo codes"
  ON promo_codes FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');
