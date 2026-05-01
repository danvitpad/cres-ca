/* --- YAML
   name: Release Consistency Sweep
   description: Idempotent re-application of objects that were applied directly
     to prod via MCP without committing migration files. Safe to run on prod
     (IF NOT EXISTS / OR REPLACE), required for clean rebuilds and staging.
   created: 2026-05-01
   --- */

-- ─── 1. masters: customization columns (applied via MCP, no file) ───
ALTER TABLE public.masters
  ADD COLUMN IF NOT EXISTS theme_primary_color text DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS theme_background_color text,
  ADD COLUMN IF NOT EXISTS banner_position_y integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'master',
  ADD COLUMN IF NOT EXISTS phone_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_public boolean DEFAULT false;

-- Hex colour validation (ignore if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'masters_theme_primary_color_hex'
  ) THEN
    ALTER TABLE public.masters
      ADD CONSTRAINT masters_theme_primary_color_hex
      CHECK (theme_primary_color IS NULL OR theme_primary_color ~* '^#[0-9a-f]{6}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'masters_theme_background_color_hex'
  ) THEN
    ALTER TABLE public.masters
      ADD CONSTRAINT masters_theme_background_color_hex
      CHECK (theme_background_color IS NULL OR theme_background_color ~* '^#[0-9a-f]{6}$');
  END IF;
END $$;

-- ─── 2. master_broadcasts (00117 — applied via MCP, no file) ───
CREATE TABLE IF NOT EXISTS public.master_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  subject text,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'subscribers',
  filters jsonb DEFAULT '{}'::jsonb,
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_broadcasts_master_id_idx
  ON public.master_broadcasts (master_id, created_at DESC);

ALTER TABLE public.master_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcasts_master_full" ON public.master_broadcasts;
CREATE POLICY "broadcasts_master_full" ON public.master_broadcasts
  FOR ALL USING (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  );

-- ─── 3. master_broadcast_deliveries (00117 — applied via MCP, no file) ───
CREATE TABLE IF NOT EXISTS public.master_broadcast_deliveries (
  broadcast_id uuid NOT NULL REFERENCES public.master_broadcasts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivered boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  error text,
  PRIMARY KEY (broadcast_id, profile_id)
);

CREATE INDEX IF NOT EXISTS broadcast_deliveries_profile_idx
  ON public.master_broadcast_deliveries (profile_id);

ALTER TABLE public.master_broadcast_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_master_read" ON public.master_broadcast_deliveries;
CREATE POLICY "deliveries_master_read" ON public.master_broadcast_deliveries
  FOR SELECT USING (
    broadcast_id IN (
      SELECT id FROM public.master_broadcasts
      WHERE master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
    )
  );

-- ─── 4. updated_at trigger for master_broadcasts ───
CREATE OR REPLACE FUNCTION public._touch_master_broadcasts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_master_broadcasts_updated_at ON public.master_broadcasts;
CREATE TRIGGER trg_master_broadcasts_updated_at
  BEFORE UPDATE ON public.master_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public._touch_master_broadcasts_updated_at();
