-- --- YAML
-- name: Team Mode — Appointments Extension
-- description: Adds salon_id (FK) and created_by_role to appointments for salon-scoped access and audit.
--              Nullable defaults preserve solo-master behavior (salon_id IS NULL unaffected by existing RLS).
-- created: 2026-04-19

alter table public.appointments
  add column if not exists salon_id uuid references public.salons(id) on delete set null,
  add column if not exists created_by_role text
    check (created_by_role in ('admin', 'master', 'receptionist', 'client', 'voice_ai'));

create index if not exists idx_appointments_salon_starts
  on public.appointments (salon_id, starts_at desc)
  where salon_id is not null;

comment on column public.appointments.salon_id is
  'Denormalised salon reference — populated from masters.salon_id at insert time. NULL for solo masters.';
comment on column public.appointments.created_by_role is
  'Who booked the appointment: admin / master / receptionist / client / voice_ai. Nullable for legacy rows.';

-- Backfill existing rows where the master already belongs to a salon.
update public.appointments a
set salon_id = m.salon_id
from public.masters m
where a.master_id = m.id
  and m.salon_id is not null
  and a.salon_id is null;
