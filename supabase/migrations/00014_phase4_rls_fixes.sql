-- Phase 4 client self-service: missing RLS policies discovered during prod verification
-- Applied to live DB on 2026-04-12 as `clients_can_cancel_own_appointments` and `avatars_storage_policies`.

-- 1. Allow clients to UPDATE their own appointments (needed for cancel-with-reason flow)
CREATE POLICY "Clients can update own appointments" ON appointments
FOR UPDATE
USING (
  client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
)
WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
);

-- 2. Storage policies for the public `avatars` bucket
--    RLS is on for storage.objects but the bucket had zero policies, so uploads 403'd.
CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
