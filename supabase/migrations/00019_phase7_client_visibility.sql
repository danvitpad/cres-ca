-- Phase 7: client-side visibility for files and intake
-- 1. Allow client (profile_id) to read their own client_files (before/after photos uploaded by master)
-- 2. Allow master to read client_health_profiles for their own clients (intake forms)

CREATE POLICY client_files_self_read ON public.client_files
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY client_health_master_read ON public.client_health_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.masters m ON m.id = c.master_id
      WHERE c.profile_id = client_health_profiles.profile_id
        AND m.profile_id = auth.uid()
    )
  );
