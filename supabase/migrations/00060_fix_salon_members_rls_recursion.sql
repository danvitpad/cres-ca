-- --- YAML
-- name: Fix salon_members RLS infinite recursion
-- description: The "Admins can manage/view salon members" policies referenced salon_members
--              inside a subquery, causing infinite recursion whenever any RLS path that joined
--              on salon_members fired (clients, appointments, expenses admin policies all did).
--              Result: solo masters got 42P17 on /clients, and any non-owner team query hit the
--              same error. Fix replaces self-referential subqueries with SECURITY DEFINER helpers
--              that bypass RLS when checking membership.
-- created: 2026-04-19

-- Helper: does the current auth user own the salon?
create or replace function public.is_salon_owner(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.salons
    where id = p_salon_id and owner_id = auth.uid()
  );
$$;

-- Helper: is the current auth user an active admin of the given salon?
create or replace function public.is_salon_admin(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id
      and profile_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

-- Helper: is the current auth user an active receptionist of the given salon?
create or replace function public.is_salon_receptionist(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id
      and profile_id = auth.uid()
      and role = 'receptionist'
      and status = 'active'
  );
$$;

grant execute on function public.is_salon_owner(uuid) to authenticated;
grant execute on function public.is_salon_admin(uuid) to authenticated;
grant execute on function public.is_salon_receptionist(uuid) to authenticated;

-- ============================================================
-- SALON_MEMBERS — fix the recursion root
-- ============================================================

drop policy if exists "Admins can manage salon members" on public.salon_members;
drop policy if exists "Admins can view salon members" on public.salon_members;

create policy "Salon owners can manage members"
  on public.salon_members for all
  using (public.is_salon_owner(salon_id))
  with check (public.is_salon_owner(salon_id));

create policy "Salon admins can view members"
  on public.salon_members for select
  using (public.is_salon_admin(salon_id));

-- ============================================================
-- Re-express downstream policies using the same helpers.
-- This removes remaining salon_members subqueries from policies on
-- appointments / clients / expenses so future RLS evaluation can't
-- revisit the recursive path even once.
-- ============================================================

-- APPOINTMENTS
drop policy if exists "Salon admins can manage appointments" on public.appointments;
create policy "Salon admins can manage appointments"
  on public.appointments for all
  using (salon_id is not null and public.is_salon_admin(salon_id))
  with check (salon_id is not null and public.is_salon_admin(salon_id));

drop policy if exists "Salon receptionists can view appointments" on public.appointments;
create policy "Salon receptionists can view appointments"
  on public.appointments for select
  using (salon_id is not null and public.is_salon_receptionist(salon_id));

drop policy if exists "Salon receptionists can create appointments" on public.appointments;
create policy "Salon receptionists can create appointments"
  on public.appointments for insert
  with check (salon_id is not null and public.is_salon_receptionist(salon_id));

drop policy if exists "Salon receptionists can update appointments" on public.appointments;
create policy "Salon receptionists can update appointments"
  on public.appointments for update
  using (salon_id is not null and public.is_salon_receptionist(salon_id))
  with check (salon_id is not null and public.is_salon_receptionist(salon_id));

-- CLIENTS
drop policy if exists "Salon admins can manage clients" on public.clients;
create policy "Salon admins can manage clients"
  on public.clients for all
  using (
    (salon_id is not null and public.is_salon_admin(salon_id))
    or master_id in (select m.id from public.masters m where m.salon_id is not null and public.is_salon_admin(m.salon_id))
  )
  with check (
    (salon_id is not null and public.is_salon_admin(salon_id))
    or master_id in (select m.id from public.masters m where m.salon_id is not null and public.is_salon_admin(m.salon_id))
  );

drop policy if exists "Salon receptionists can view clients" on public.clients;
create policy "Salon receptionists can view clients"
  on public.clients for select
  using (
    (salon_id is not null and public.is_salon_receptionist(salon_id))
    or master_id in (select m.id from public.masters m where m.salon_id is not null and public.is_salon_receptionist(m.salon_id))
  );

drop policy if exists "Salon receptionists can create clients" on public.clients;
create policy "Salon receptionists can create clients"
  on public.clients for insert
  with check (
    (salon_id is not null and public.is_salon_receptionist(salon_id))
    or master_id in (select m.id from public.masters m where m.salon_id is not null and public.is_salon_receptionist(m.salon_id))
  );

-- EXPENSES
drop policy if exists "Salon admins can manage salon expenses" on public.expenses;
create policy "Salon admins can manage salon expenses"
  on public.expenses for all
  using (salon_id is not null and public.is_salon_admin(salon_id))
  with check (salon_id is not null and public.is_salon_admin(salon_id));
