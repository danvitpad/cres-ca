-- 00136_web_push_subscriptions.sql
--
-- Web Push API: store browser push subscriptions per profile.
-- A user can have multiple subscriptions (one per device/browser) — each
-- with a unique `endpoint` URL provided by the browser's push service
-- (FCM/Mozilla/etc).

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  failure_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_web_push_subs_profile
  ON web_push_subscriptions(profile_id);

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_push_subs_select ON web_push_subscriptions;
CREATE POLICY web_push_subs_select ON web_push_subscriptions FOR SELECT
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS web_push_subs_insert ON web_push_subscriptions;
CREATE POLICY web_push_subs_insert ON web_push_subscriptions FOR INSERT
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS web_push_subs_delete ON web_push_subscriptions;
CREATE POLICY web_push_subs_delete ON web_push_subscriptions FOR DELETE
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS web_push_subs_update ON web_push_subscriptions;
CREATE POLICY web_push_subs_update ON web_push_subscriptions FOR UPDATE
USING (profile_id = auth.uid());

COMMENT ON TABLE web_push_subscriptions IS
  'Browser Web Push API subscriptions. One row per device/browser.';
