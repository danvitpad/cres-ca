-- Add missing columns to salons table referenced by /s/[slug] public page
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS email     text,
  ADD COLUMN IF NOT EXISTS bio       text;
