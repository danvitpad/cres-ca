-- Tour progress: tracks which spotlight hints have been shown per user.
-- JSONB object like {"calendar_add": true, "services_add": true, "clients_empty": true}
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_progress jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.tour_progress IS 'Tracks which onboarding spotlight hints have been dismissed. Reset to {} to replay tour.';
