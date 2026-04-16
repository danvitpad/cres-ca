-- Add jsonb data column to notifications for storing structured metadata
-- (type: new_follower, mutual_follow, etc. + related profile IDs)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}';
