/** --- YAML
 * name: 00081_verification
 * description: Manual trust verification — photo upload (selfie+document for identity, certificate for expertise). Superadmin reviews and flips `verified_at` / `expertise_verified_at` on masters. No Diia integration — just a human review queue.
 * created: 2026-04-24
 * --- */

-- ─── 1. Master verification flags ───
alter table public.masters
  add column if not exists verified_at timestamptz,                -- identity verified (selfie+doc)
  add column if not exists expertise_verified_at timestamptz;       -- cert verified (uploaded cert)

comment on column public.masters.verified_at is
  'Trust tier 1: master provided photo ID + selfie, superadmin approved. Shown as blue checkmark in UI.';
comment on column public.masters.expertise_verified_at is
  'Trust tier 2: master provided professional certificate photo, superadmin approved. Shown as expert badge.';

-- ─── 2. verification_requests table ───
create type verification_kind as enum ('identity', 'expertise');
create type verification_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  master_id uuid references public.masters(id) on delete cascade,
  kind verification_kind not null,
  status verification_status not null default 'pending',

  -- Uploaded photos (URLs in Supabase Storage)
  selfie_url text,             -- identity: holding doc next to face
  document_url text not null,  -- identity: ID/passport page; expertise: cert

  -- Superadmin decision
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,

  -- Applicant-provided metadata
  note text,

  created_at timestamptz not null default now()
);

create index if not exists idx_verif_status on public.verification_requests(status) where status = 'pending';
create index if not exists idx_verif_profile on public.verification_requests(profile_id, kind, created_at desc);

alter table public.verification_requests enable row level security;

-- Master creates + reads own requests
drop policy if exists "verif_own_insert" on public.verification_requests;
create policy "verif_own_insert" on public.verification_requests
  for insert with check (profile_id = auth.uid());

drop policy if exists "verif_own_read" on public.verification_requests;
create policy "verif_own_read" on public.verification_requests
  for select using (profile_id = auth.uid());

-- Superadmin can see + update all
drop policy if exists "verif_superadmin_all" on public.verification_requests;
create policy "verif_superadmin_all" on public.verification_requests
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  );

-- ─── 3. Storage bucket for uploads (private — only owner + superadmin can read) ───
insert into storage.buckets (id, name, public)
  values ('verification', 'verification', false)
  on conflict (id) do nothing;

-- User can upload their own verification photos
drop policy if exists "verif_upload_own" on storage.objects;
create policy "verif_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- User can read their own
drop policy if exists "verif_read_own" on storage.objects;
create policy "verif_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid()
        and p.email in ('daniilpadalko97@gmail.com'))
    )
  );
