-- Block D: Client Cards & CRM enhancements
-- D5: Manual blacklist support
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS blacklist_reason text;

-- D2: Vertical column on masters (idempotent — may already exist from onboarding API)
ALTER TABLE masters ADD COLUMN IF NOT EXISTS vertical text;
