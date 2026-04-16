-- Index for mutual-follow lookups (follows table already exists)
CREATE INDEX IF NOT EXISTS idx_follows_mutual ON follows(following_id, follower_id);

-- ============================================================
-- Sync trigger: follows → client_master_links
-- Keeps CML in sync for feed RLS, invite/claim, burning-slots
-- ============================================================

CREATE OR REPLACE FUNCTION sync_follow_to_cml()
RETURNS trigger AS $$
DECLARE
  v_follower_role user_role;
  v_following_role user_role;
  v_master_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT role INTO v_follower_role FROM profiles WHERE id = NEW.follower_id;
    SELECT role INTO v_following_role FROM profiles WHERE id = NEW.following_id;

    -- Client follows master → create CML row
    IF v_follower_role = 'client' AND v_following_role = 'master' THEN
      SELECT id INTO v_master_id FROM masters WHERE profile_id = NEW.following_id LIMIT 1;
      IF v_master_id IS NOT NULL THEN
        INSERT INTO client_master_links (profile_id, master_id)
        VALUES (NEW.follower_id, v_master_id)
        ON CONFLICT (profile_id, master_id) DO NOTHING;
      END IF;
    END IF;

    -- Master follows client back → set master_follows_back on CML
    IF v_follower_role = 'master' AND v_following_role = 'client' THEN
      SELECT id INTO v_master_id FROM masters WHERE profile_id = NEW.follower_id LIMIT 1;
      IF v_master_id IS NOT NULL THEN
        UPDATE client_master_links
        SET master_follows_back = true,
            master_followed_back_at = now()
        WHERE profile_id = NEW.following_id
          AND master_id = v_master_id;
      END IF;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT role INTO v_follower_role FROM profiles WHERE id = OLD.follower_id;
    SELECT role INTO v_following_role FROM profiles WHERE id = OLD.following_id;

    -- Client unfollows master → delete CML row
    IF v_follower_role = 'client' AND v_following_role = 'master' THEN
      SELECT id INTO v_master_id FROM masters WHERE profile_id = OLD.following_id LIMIT 1;
      IF v_master_id IS NOT NULL THEN
        DELETE FROM client_master_links
        WHERE profile_id = OLD.follower_id AND master_id = v_master_id;
      END IF;
    END IF;

    -- Master unfollows client → clear master_follows_back
    IF v_follower_role = 'master' AND v_following_role = 'client' THEN
      SELECT id INTO v_master_id FROM masters WHERE profile_id = OLD.follower_id LIMIT 1;
      IF v_master_id IS NOT NULL THEN
        UPDATE client_master_links
        SET master_follows_back = false,
            master_followed_back_at = NULL
        WHERE profile_id = OLD.following_id
          AND master_id = v_master_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_follow_cml
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_to_cml();

-- Search indexes for global search
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_pattern
  ON profiles USING btree (lower(full_name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_phone_pattern
  ON profiles USING btree (phone text_pattern_ops) WHERE phone IS NOT NULL;
