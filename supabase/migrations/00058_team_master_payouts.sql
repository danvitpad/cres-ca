-- --- YAML
-- name: Team Mode — Master Payouts
-- description: Per-period payout records for masters in a salon (draft -> confirmed -> paid).
--              Unified mode: net_payout = revenue * commission_percent.
--              Marketplace mode: owner receives commission_amount (rev*owner_commission) or rent_amount; master net = revenue - those.
-- created: 2026-04-19

create table if not exists public.master_payouts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  master_id uuid not null references public.masters(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_revenue numeric not null default 0,
  commission_percent numeric not null default 0,
  commission_amount numeric not null default 0,
  rent_amount numeric not null default 0,
  net_payout numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'paid')),
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (salon_id, master_id, period_start, period_end)
);

create index if not exists idx_master_payouts_salon on public.master_payouts (salon_id, period_start desc);
create index if not exists idx_master_payouts_master on public.master_payouts (master_id, period_start desc);

alter table public.master_payouts enable row level security;

-- Admin of the salon can manage all payouts
create policy "Admins can manage salon payouts"
  on public.master_payouts for all
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

-- Master sees only own payouts
create policy "Masters can view own payouts"
  on public.master_payouts for select
  using (
    master_id in (
      select m.id from public.masters m where m.profile_id = auth.uid()
    )
  );
