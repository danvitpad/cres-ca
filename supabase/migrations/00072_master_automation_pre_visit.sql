-- Phase 8: add pre-visit master push toggle to automation settings.
ALTER TABLE public.master_automation_settings
  ADD COLUMN IF NOT EXISTS pre_visit_master BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN public.master_automation_settings.pre_visit_master
  IS 'Send the master a context-rich push 30 min before each appointment (client notes, allergies, last visit).';
