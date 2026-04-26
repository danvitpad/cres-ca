-- 00101_promo_codes_discount_type.sql
-- The dashboard /marketing → Акции form sends `discount_type` ('percentage' | 'fixed')
-- and `discount_value` (numeric), but the prod table only had legacy `discount_percent`.
-- Result: PostgREST 400 "Could not find the 'discount_type' column of 'promo_codes' in the schema cache".
-- Add the missing columns and backfill from `discount_percent` so existing rows keep working.

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0;

-- Backfill existing rows: legacy `discount_percent` value carried over to discount_value
UPDATE public.promo_codes
SET discount_value = discount_percent
WHERE discount_value = 0 AND discount_percent > 0;

COMMENT ON COLUMN public.promo_codes.discount_type IS 'Discount type — percentage (off the price) or fixed (subtract a UAH amount).';
COMMENT ON COLUMN public.promo_codes.discount_value IS 'Discount value. Interpreted per discount_type: % off if percentage, UAH off if fixed.';
