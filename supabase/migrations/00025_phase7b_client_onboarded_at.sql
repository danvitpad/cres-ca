-- Phase 7b: track when a client finished the first-run onboarding wizard.
-- NULL means never completed → wizard shows on next login.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS client_onboarded_at timestamptz;
