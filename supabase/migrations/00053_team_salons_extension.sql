-- --- YAML
-- name: Team Mode — Salons Extension
-- description: Adds team-mode configuration columns to salons (team_mode, owner payouts, default commission, permissions).
--              Backward-compatible: all new columns nullable or have sensible defaults; solo masters (salon_id IS NULL) untouched.
-- created: 2026-04-19

alter table public.salons
  add column if not exists team_mode text not null default 'unified'
    check (team_mode in ('unified', 'marketplace')),
  add column if not exists owner_commission_percent numeric default 0,
  add column if not exists owner_rent_per_master numeric default 0,
  add column if not exists default_master_commission numeric default 50,
  add column if not exists allow_master_own_clients boolean not null default false,
  add column if not exists allow_master_own_pricing boolean not null default false;

comment on column public.salons.team_mode is
  'Immutable after creation: unified (salon owns clients/catalogue) vs marketplace (masters are independent inside the salon).';
comment on column public.salons.owner_commission_percent is
  'Marketplace mode: % of master revenue owner receives (0 = owner charges fixed rent).';
comment on column public.salons.owner_rent_per_master is
  'Marketplace mode: fixed monthly rent per master (used instead of commission).';
comment on column public.salons.default_master_commission is
  'Unified mode: default % paid to each master when salon_members row has no override.';
