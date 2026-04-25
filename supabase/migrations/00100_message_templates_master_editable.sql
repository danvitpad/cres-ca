-- Master-editable message templates for marketing automations.
-- Several cron jobs (reminders, cadence, win-back, NPS) already read from this
-- table via lib/messaging/render-template.ts → pickTemplate(). This migration
-- ensures the table exists with the canonical schema and adds RLS so masters
-- can CRUD only their own rows from the dashboard.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  content     text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_templates_master_kind_idx
  ON public.message_templates (master_id, kind)
  WHERE is_active;

-- One active template per (master, kind). Master can keep inactive copies as drafts.
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_unique_active
  ON public.message_templates (master_id, kind)
  WHERE is_active;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Master can read/write only their own templates.
DROP POLICY IF EXISTS message_templates_select_own ON public.message_templates;
CREATE POLICY message_templates_select_own
  ON public.message_templates
  FOR SELECT
  USING (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS message_templates_insert_own ON public.message_templates;
CREATE POLICY message_templates_insert_own
  ON public.message_templates
  FOR INSERT
  WITH CHECK (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS message_templates_update_own ON public.message_templates;
CREATE POLICY message_templates_update_own
  ON public.message_templates
  FOR UPDATE
  USING (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS message_templates_delete_own ON public.message_templates;
CREATE POLICY message_templates_delete_own
  ON public.message_templates
  FOR DELETE
  USING (
    master_id IN (SELECT id FROM public.masters WHERE profile_id = auth.uid())
  );

-- updated_at touch
CREATE OR REPLACE FUNCTION public.message_templates_touch_updated()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_templates_touch_updated ON public.message_templates;
CREATE TRIGGER trg_message_templates_touch_updated
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.message_templates_touch_updated();

COMMENT ON TABLE public.message_templates IS
  'Per-master message templates for marketing automations. Read by cron jobs via pickTemplate().';
COMMENT ON COLUMN public.message_templates.kind IS
  'Automation kind: reminder_24h | reminder_2h | review_request | cadence | win_back | nps | pre_visit_master | birthday_client';
COMMENT ON COLUMN public.message_templates.content IS
  'Template body with {variable} placeholders. Variables vary by kind — see docs.';
