-- Add first_name and last_name columns to profiles
-- full_name kept for backward compatibility (computed from first + last)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;

-- Migrate existing data: split full_name → first_name + last_name
UPDATE profiles
SET
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE
    WHEN position(' ' in full_name) > 0
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE NULL
  END
WHERE first_name IS NULL AND full_name IS NOT NULL;
