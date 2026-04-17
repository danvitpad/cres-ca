-- --- YAML
-- name: feature_overrides
-- description: Add feature_overrides JSONB to masters table for per-master module toggles that override vertical defaults. Add extra_info JSONB to clients for per-vertical extra fields.
-- created: 2026-04-17
-- ---

-- Masters: feature toggles that override vertical defaults
ALTER TABLE masters
  ADD COLUMN IF NOT EXISTS feature_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN masters.feature_overrides IS
  'Per-master feature flag overrides. Keys match VerticalFeatures interface (healthProfile, gallery, familyLinks, memberships, giftCards, inventory, loyalty, smartRebooking, mobileVisits, onlineConsults, portfolio, reviews, voiceNotes). Empty object → all defaults from vertical apply.';

-- Clients: extra per-vertical fields (pet breed, vehicle info, kids names, preferences, etc.)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS extra_info JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN clients.extra_info IS
  'Per-vertical extra fields (see src/lib/verticals/client-fields.ts). Schema depends on master.vertical: e.g. beauty → kids/pets/hair_type; auto → vehicle_make/model/plate; pets → pet_name/breed/weight.';

-- Index for feature overrides queries (rare, but useful for feature analytics)
CREATE INDEX IF NOT EXISTS idx_masters_feature_overrides
  ON masters USING GIN (feature_overrides);
