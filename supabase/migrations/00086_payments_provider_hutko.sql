/** --- YAML
 * name: 00086_payments_provider_hutko
 * description: Phase 2.1 — finalise payment provider abstraction. Add provider_refund_id
 *              and provider_payout_id tracking to payment_intents. Switch default provider
 *              to Hutko. Per-provider payouts log for reconciliation.
 * created: 2026-04-24
 * --- */

-- Track provider-side IDs for refund + payout lifecycle
alter table public.payment_intents
  add column if not exists provider_refund_id text,
  add column if not exists provider_payout_id text,
  add column if not exists refund_amount numeric(10,2),
  add column if not exists refund_reason text;

-- Switch defaults: Hutko is now the primary for escrow
alter table public.payment_intents
  alter column provider set default 'hutko';

alter table public.masters
  alter column payout_provider set default 'hutko';

-- Standalone payouts log — one row per physical transfer to a master.
-- Multiple held intents can be settled in a single weekly payout for efficiency.
create table if not exists public.master_payouts (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  provider text not null default 'hutko',
  provider_payout_id text unique,          -- returned by provider on success
  total_amount numeric(10,2) not null,
  platform_fee_amount numeric(10,2) not null default 0,
  currency text not null default 'UAH',
  intent_ids uuid[] not null default '{}',  -- which payment_intents were bundled
  status text not null default 'queued'
    check (status in ('queued','sent','completed','failed','reversed')),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  completed_at timestamptz,
  error_message text
);

create index if not exists idx_master_payouts_status on public.master_payouts(status, queued_at);
create index if not exists idx_master_payouts_master on public.master_payouts(master_id, queued_at desc);

alter table public.master_payouts enable row level security;

drop policy if exists "mp_master_read" on public.master_payouts;
create policy "mp_master_read" on public.master_payouts
  for select using (
    master_id in (select id from public.masters where profile_id = auth.uid())
  );

drop policy if exists "mp_superadmin_all" on public.master_payouts;
create policy "mp_superadmin_all" on public.master_payouts
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  );

comment on table public.master_payouts is
  'Log of actual money transfers to masters. Created when an intent is released; may bundle multiple intents in one provider call.';
