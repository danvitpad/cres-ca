/** --- YAML
 * name: Remove Social Features + Add Contacts/Portfolio Limits
 * description: Drops Instagram-style tables (posts, post_likes, master_likes, master_stories).
 *              Restricts feed_posts to type='burning_slot' only. Adds portfolio_photo_limit to
 *              subscription_plans.limits. Adds before_after subtype to master_portfolio.
 *              Creates salon_follows for client→salon contacts. Idempotent and safe to re-run.
 * created: 2026-04-25
 * --- */

-- ============================================================
-- 1. DROP social tables (Instagram-style features removal)
-- ============================================================

DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.master_likes CASCADE;
DROP TABLE IF EXISTS public.master_stories CASCADE;

-- masters.likes_count denormalized counter (no longer needed)
ALTER TABLE public.masters DROP COLUMN IF EXISTS likes_count;

-- ============================================================
-- 2. feed_posts → only burning_slot type
-- ============================================================

-- Remove any non-slot posts (no UI consumes them anymore)
DELETE FROM public.feed_posts WHERE type IS NULL OR type <> 'burning_slot';

-- Replace CHECK constraint to lock type to 'burning_slot'
ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_type_check;
ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_type_check CHECK (type = 'burning_slot');

-- ============================================================
-- 3. subscription_plans.limits — add portfolio_photo_limit
-- (-1 = unlimited, matches existing convention for max_clients/max_masters)
-- ============================================================

UPDATE public.subscription_plans
SET limits = limits || jsonb_build_object('portfolio_photo_limit',
  CASE
    WHEN slug = 'free'     THEN 5
    WHEN slug = 'pro'      THEN 20
    WHEN slug = 'business' THEN -1
    ELSE 5
  END);

-- ============================================================
-- 4. master_portfolio → before_after subtype
-- (single gallery — before/after is a flag + optional second image, not a separate table)
-- ============================================================

ALTER TABLE public.master_portfolio ADD COLUMN IF NOT EXISTS is_before_after boolean NOT NULL DEFAULT false;
ALTER TABLE public.master_portfolio ADD COLUMN IF NOT EXISTS before_url text;
ALTER TABLE public.master_portfolio ADD COLUMN IF NOT EXISTS after_url text;

-- Migrate existing before_after_photos (if table exists) into master_portfolio as is_before_after rows
DO $$
DECLARE
  has_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'before_after_photos'
  ) INTO has_table;

  IF has_table THEN
    INSERT INTO public.master_portfolio (master_id, image_url, before_url, after_url, caption, is_before_after, is_published)
    SELECT
      master_id,
      after_url AS image_url,  -- after photo as the cover
      before_url,
      after_url,
      caption,
      true,
      true
    FROM public.before_after_photos
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- ============================================================
-- 5. salon_follows — client → salon contacts
-- (universal "follows" table is profile↔profile; salons need their own)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.salon_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, salon_id)
);

CREATE INDEX IF NOT EXISTS idx_salon_follows_profile ON public.salon_follows(profile_id);
CREATE INDEX IF NOT EXISTS idx_salon_follows_salon ON public.salon_follows(salon_id);

ALTER TABLE public.salon_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_manage_own_salon_follows" ON public.salon_follows;
CREATE POLICY "client_manage_own_salon_follows" ON public.salon_follows
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "salon_owner_views_followers" ON public.salon_follows;
CREATE POLICY "salon_owner_views_followers" ON public.salon_follows
  FOR SELECT TO authenticated
  USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- ============================================================
-- 6. (Optional) drop legacy before_after_photos after data migration
-- Uncomment after verifying master_portfolio has before/after rows imported.
-- ============================================================
-- DROP TABLE IF EXISTS public.before_after_photos CASCADE;
