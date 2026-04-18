-- --- YAML
-- name: Team Mode — Salon Invites
-- description: Invite codes (7-day TTL by default) that new masters/receptionists redeem to join a salon.
--              Separate from legacy masters.invite_code (solo-master onboarding) — keep both in parallel.
-- created: 2026-04-19

create table if not exists public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  role text not null check (role in ('master', 'receptionist')),
  code text unique not null default encode(gen_random_bytes(8), 'hex'),
  email text,
  phone text,
  telegram_username text,
  invited_by uuid references public.profiles(id) on delete set null,
  used_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists idx_salon_invites_code on public.salon_invites (code);
create index if not exists idx_salon_invites_salon on public.salon_invites (salon_id);

alter table public.salon_invites enable row level security;

-- Admins see all invites of their salon
create policy "Admins can view salon invites"
  on public.salon_invites for select
  using (
    salon_id in (select s.id from public.salons s where s.owner_id = auth.uid())
    or salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  );

-- Admins can create/update/delete invites of their salon
create policy "Admins can manage salon invites"
  on public.salon_invites for all
  using (
    salon_id in (select s.id from public.salons s where s.owner_id = auth.uid())
    or salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  )
  with check (
    salon_id in (select s.id from public.salons s where s.owner_id = auth.uid())
    or salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  );

-- Invitees can look up their invite by code during acceptance flow (public landing reads via service_role; this is a safety net).
create policy "Invitees can read their own invite"
  on public.salon_invites for select
  using (used_by = auth.uid());
