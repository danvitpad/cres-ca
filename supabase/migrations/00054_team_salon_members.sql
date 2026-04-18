-- --- YAML
-- name: Team Mode — Salon Members
-- description: Role mapping (admin/master/receptionist) between profiles and salons.
--              One row per (salon, profile). Admin = owner by default; masters link back via master_id.
-- created: 2026-04-19

create table if not exists public.salon_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  master_id uuid references public.masters(id) on delete set null,
  role text not null check (role in ('admin', 'master', 'receptionist')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'removed')),
  commission_percent numeric,
  rent_amount numeric,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (salon_id, profile_id)
);

create index if not exists idx_salon_members_salon on public.salon_members (salon_id, status);
create index if not exists idx_salon_members_profile on public.salon_members (profile_id);
create index if not exists idx_salon_members_master on public.salon_members (master_id) where master_id is not null;

alter table public.salon_members enable row level security;

-- Members can see their own row
create policy "Members can view own membership"
  on public.salon_members for select
  using (profile_id = auth.uid());

-- Salon admins (active role='admin' or owner_id) can view all members of their salon
create policy "Admins can view salon members"
  on public.salon_members for select
  using (
    salon_id in (
      select s.id from public.salons s where s.owner_id = auth.uid()
    )
    or salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  );

-- Admins can insert/update/delete members in their salon
create policy "Admins can manage salon members"
  on public.salon_members for all
  using (
    salon_id in (
      select s.id from public.salons s where s.owner_id = auth.uid()
    )
    or salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  )
  with check (
    salon_id in (
      select s.id from public.salons s where s.owner_id = auth.uid()
    )
    or salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  );

comment on table public.salon_members is
  'Role mapping (admin/master/receptionist) between profiles and salons. Unique per (salon, profile).';
