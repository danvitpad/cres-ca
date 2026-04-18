-- --- YAML
-- name: Team Mode — Clients Extension
-- description: Adds salon_id (FK) and visibility (owner/salon/master_only) to clients.
--              visibility controls cross-master visibility in team mode; default 'owner' preserves solo behavior.
-- created: 2026-04-19

alter table public.clients
  add column if not exists salon_id uuid references public.salons(id) on delete set null,
  add column if not exists visibility text not null default 'owner'
    check (visibility in ('owner', 'salon', 'master_only'));

create index if not exists idx_clients_salon on public.clients (salon_id) where salon_id is not null;

comment on column public.clients.visibility is
  'owner = legacy (solo); salon = unified mode (admins/receptionists see all clients); master_only = marketplace mode (only owning master sees).';

-- Backfill salon_id from master for existing clients where the master belongs to a salon.
update public.clients c
set salon_id = m.salon_id
from public.masters m
where c.master_id = m.id
  and m.salon_id is not null
  and c.salon_id is null;
