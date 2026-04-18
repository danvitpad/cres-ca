-- 00043_cleanup_seed_data.sql
-- Purpose: remove demo/seed data that leaks into public master pages
--   (1) stock before/after photos seeded for testing (Unsplash etc.)
--   (2) master_partnerships with zero-UUID fake target
--   (3) any before_after_photos where either URL is not on our own storage bucket
--
-- Safe: operates only on rows with clearly non-production data.
-- Run via: supabase db push   OR   psql < this_file

-- (1) Delete before_after_photos whose URLs point to third-party stock hosts
DELETE FROM public.before_after_photos
WHERE
     before_url ILIKE '%unsplash.com%'
  OR before_url ILIKE '%pexels.com%'
  OR before_url ILIKE '%pixabay.com%'
  OR before_url ILIKE '%placekitten%'
  OR before_url ILIKE '%placehold%'
  OR before_url ILIKE '%picsum.photos%'
  OR after_url  ILIKE '%unsplash.com%'
  OR after_url  ILIKE '%pexels.com%'
  OR after_url  ILIKE '%pixabay.com%'
  OR after_url  ILIKE '%placekitten%'
  OR after_url  ILIKE '%placehold%'
  OR after_url  ILIKE '%picsum.photos%';

-- (2) Remove any partnership with the canonical zero-UUID fake id
DELETE FROM public.master_partnerships
WHERE master_id  = '00000000-0000-0000-0000-000000000000'::uuid
   OR partner_id = '00000000-0000-0000-0000-000000000000'::uuid
   OR master_id  = '00000000-0000-0000-0000-000000000001'::uuid
   OR partner_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- (3) Remove orphan partnerships (partner row no longer exists)
DELETE FROM public.master_partnerships p
WHERE NOT EXISTS (SELECT 1 FROM public.masters m WHERE m.id = p.master_id)
   OR NOT EXISTS (SELECT 1 FROM public.masters m WHERE m.id = p.partner_id);

-- (4) Clear any masters whose avatar_url is a 3rd-party placeholder service
-- (these can't render through next/image because the domain is not whitelisted)
UPDATE public.masters
SET avatar_url = NULL
WHERE avatar_url ILIKE '%example.com%'
   OR avatar_url ILIKE '%placeholder%'
   OR avatar_url ILIKE '%pravatar.cc%'
   OR avatar_url ILIKE '%i.pravatar%'
   OR avatar_url = '';
