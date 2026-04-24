/** --- YAML
 * name: 00084_rollback_verification
 * description: Rollback of 00081 — removes verification_requests, masters.verified_at/expertise_verified_at,
 *              storage bucket + policies, and the enums. Safe to re-run (all DROPs are IF EXISTS).
 * created: 2026-04-24
 * --- */

-- Storage policies first (objects before bucket)
drop policy if exists "verif_upload_own" on storage.objects;
drop policy if exists "verif_read_own" on storage.objects;

-- Clear bucket (this removes all uploaded files). If you want to keep them,
-- run this block manually, otherwise the bucket delete will fail.
delete from storage.objects where bucket_id = 'verification';
delete from storage.buckets where id = 'verification';

-- Drop table + RLS policies
drop policy if exists "verif_own_insert" on public.verification_requests;
drop policy if exists "verif_own_read" on public.verification_requests;
drop policy if exists "verif_superadmin_all" on public.verification_requests;
drop table if exists public.verification_requests;

-- Drop enums
drop type if exists verification_kind;
drop type if exists verification_status;

-- Drop columns on masters
alter table public.masters
  drop column if exists verified_at,
  drop column if exists expertise_verified_at;
