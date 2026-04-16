-- Block F: Finance production readiness — schema additions
-- F1: payment_method on payments (cash/card/online/gift_card)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method text
  CHECK (payment_method IN ('cash', 'card', 'online', 'gift_card', 'other'))
  DEFAULT 'other';

-- F1: tip_amount on payments (tips tracked per payment, not per appointment)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) NOT NULL DEFAULT 0;

-- F2: balance_remaining on gift_certificates for partial redemption
ALTER TABLE gift_certificates ADD COLUMN IF NOT EXISTS balance_remaining numeric(10,2);
-- Backfill: unredeemed cards have full balance, redeemed have 0
UPDATE gift_certificates SET balance_remaining = CASE WHEN is_redeemed THEN 0 ELSE amount END WHERE balance_remaining IS NULL;

-- F4: add 'remainder' to payment_type enum
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'remainder';

-- F6: make expenses.description nullable (was NOT NULL but often auto-generated)
ALTER TABLE expenses ALTER COLUMN description DROP NOT NULL;
ALTER TABLE expenses ALTER COLUMN description SET DEFAULT '';

-- F6: expenses needs profile_id + vendor columns
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor text;
-- Backfill profile_id from master_id
UPDATE expenses e SET profile_id = m.profile_id FROM masters m WHERE e.master_id = m.id AND e.profile_id IS NULL;

-- Index for expenses by profile_id
CREATE INDEX IF NOT EXISTS idx_expenses_profile_id ON expenses(profile_id);
-- Index for payments by payment_method
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
