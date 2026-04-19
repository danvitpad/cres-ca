-- --- YAML
-- name: Team Mode — RLS extensions for shared tables
-- description: Adds team-role SELECT/INSERT/UPDATE/DELETE policies on appointments, clients, expenses
--              so that non-master salon admins and receptionists can use the web team surfaces
--              (calendar / clients / finance) through the standard SSR auth supabase client.
--              All policies are additive (PERMISSIVE OR); existing solo-master / client-side
--              policies are untouched.
-- created: 2026-04-19

-- ============================================================
-- APPOINTMENTS
-- ============================================================

-- Salon owner — full control over appointments scoped by appointments.salon_id.
drop policy if exists "Salon owners can manage appointments" on public.appointments;
create policy "Salon owners can manage appointments"
  on public.appointments for all
  using (
    salon_id in (select id from public.salons where owner_id = auth.uid())
  )
  with check (
    salon_id in (select id from public.salons where owner_id = auth.uid())
  );

-- Salon admin (via salon_members) — full control.
drop policy if exists "Salon admins can manage appointments" on public.appointments;
create policy "Salon admins can manage appointments"
  on public.appointments for all
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  )
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  );

-- Receptionist — SELECT + INSERT + UPDATE (no DELETE — admins handle removals).
drop policy if exists "Salon receptionists can view appointments" on public.appointments;
create policy "Salon receptionists can view appointments"
  on public.appointments for select
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
    )
  );

drop policy if exists "Salon receptionists can create appointments" on public.appointments;
create policy "Salon receptionists can create appointments"
  on public.appointments for insert
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
    )
  );

drop policy if exists "Salon receptionists can update appointments" on public.appointments;
create policy "Salon receptionists can update appointments"
  on public.appointments for update
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
    )
  )
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
    )
  );

-- ============================================================
-- CLIENTS
-- ============================================================
-- clients.salon_id is backfilled from masters.salon_id (migration 00057) and populated for all
-- new team-scoped clients. Policies also OR in master_id → masters.salon_id for defence-in-depth.

drop policy if exists "Salon owners can manage clients" on public.clients;
create policy "Salon owners can manage clients"
  on public.clients for all
  using (
    salon_id in (select id from public.salons where owner_id = auth.uid())
    or master_id in (
      select m.id from public.masters m
      where m.salon_id in (select id from public.salons where owner_id = auth.uid())
    )
  )
  with check (
    salon_id in (select id from public.salons where owner_id = auth.uid())
    or master_id in (
      select m.id from public.masters m
      where m.salon_id in (select id from public.salons where owner_id = auth.uid())
    )
  );

drop policy if exists "Salon admins can manage clients" on public.clients;
create policy "Salon admins can manage clients"
  on public.clients for all
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
    or master_id in (
      select m.id from public.masters m
      where m.salon_id in (
        select sm.salon_id from public.salon_members sm
        where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
      )
    )
  )
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
    or master_id in (
      select m.id from public.masters m
      where m.salon_id in (
        select sm.salon_id from public.salon_members sm
        where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
      )
    )
  );

drop policy if exists "Salon receptionists can view clients" on public.clients;
create policy "Salon receptionists can view clients"
  on public.clients for select
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
    )
    or master_id in (
      select m.id from public.masters m
      where m.salon_id in (
        select sm.salon_id from public.salon_members sm
        where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
      )
    )
  );

drop policy if exists "Salon receptionists can create clients" on public.clients;
create policy "Salon receptionists can create clients"
  on public.clients for insert
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
    )
    or master_id in (
      select m.id from public.masters m
      where m.salon_id in (
        select sm.salon_id from public.salon_members sm
        where sm.profile_id = auth.uid() and sm.role = 'receptionist' and sm.status = 'active'
      )
    )
  );

-- ============================================================
-- EXPENSES
-- ============================================================
-- Existing: master can manage own; salon owner can SELECT. Need to extend owner to full control
-- and grant admins the same. Receptionists MUST NOT see expenses (finance boundary).

drop policy if exists "Salon owners can manage salon expenses" on public.expenses;
create policy "Salon owners can manage salon expenses"
  on public.expenses for all
  using (
    salon_id in (select id from public.salons where owner_id = auth.uid())
  )
  with check (
    salon_id in (select id from public.salons where owner_id = auth.uid())
  );

drop policy if exists "Salon admins can manage salon expenses" on public.expenses;
create policy "Salon admins can manage salon expenses"
  on public.expenses for all
  using (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  )
  with check (
    salon_id in (
      select sm.salon_id from public.salon_members sm
      where sm.profile_id = auth.uid() and sm.role = 'admin' and sm.status = 'active'
    )
  );
