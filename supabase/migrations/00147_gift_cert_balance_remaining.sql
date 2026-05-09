-- P4.6: Gift certificates — add balance_remaining column
-- Tracks how much value remains after partial use (initially equal to amount).
ALTER TABLE gift_certificates
  ADD COLUMN IF NOT EXISTS balance_remaining numeric(10,2);

-- Back-fill existing rows: balance = amount for unredeemed, 0 for redeemed.
UPDATE gift_certificates
  SET balance_remaining = CASE WHEN is_redeemed THEN 0 ELSE amount END
  WHERE balance_remaining IS NULL;
