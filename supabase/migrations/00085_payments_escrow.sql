/** --- YAML
 * name: 00085_payments_escrow
 * description: Phase 2 — онлайн-предоплата + escrow. payment_intents (state machine),
 *              platform_earnings (take rate accumulator), appointments.deposit_* fields,
 *              и расширение services (которое уже имеет requires_prepayment) — добавляем
 *              deposit_percent для гибкой настройки.
 * created: 2026-04-24
 * --- */

-- ─────────────────────────────────────────────────────────────
-- 1. Deposit configuration per-service
-- ─────────────────────────────────────────────────────────────
alter table public.services
  add column if not exists deposit_percent int not null default 30
    check (deposit_percent >= 0 and deposit_percent <= 100);

comment on column public.services.deposit_percent is
  'When services.requires_prepayment = true, this % of price is charged as deposit. Default 30%.';

-- Master-wide default: auto-require deposit from gray-listed clients
alter table public.masters
  add column if not exists escrow_enabled boolean not null default false,
  add column if not exists payout_provider text default 'liqpay'
    check (payout_provider in ('liqpay','hutko','monobank')),
  add column if not exists payout_account text,       -- IBAN / card / wallet (set by master in settings)
  add column if not exists payout_display_name text;  -- Shown on receipts

comment on column public.masters.escrow_enabled is
  'Master opts in to platform escrow. Can be toggled per-appointment later if needed.';

-- ─────────────────────────────────────────────────────────────
-- 2. Appointment deposit fields
-- ─────────────────────────────────────────────────────────────
alter table public.appointments
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount numeric(10,2),
  add column if not exists deposit_intent_id uuid;  -- FK set later after payment_intents exists

-- ─────────────────────────────────────────────────────────────
-- 3. payment_intents — the escrow ledger
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type payment_provider as enum ('liqpay','hutko','monobank','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_intent_status as enum (
    'pending',     -- order created on our side, awaiting client payment
    'held',        -- client paid, funds in platform escrow
    'released',    -- transferred to master (visit completed + dispute window passed)
    'captured',    -- master kept it (no-show case)
    'refunded',    -- returned to client (cancelled in time)
    'failed',      -- provider rejected (card declined, etc.)
    'expired'      -- never paid within the window
  );
exception when duplicate_object then null; end $$;

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),

  -- What is paid for
  appointment_id uuid references public.appointments(id) on delete set null,
  master_id uuid not null references public.masters(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  -- Money
  amount numeric(10,2) not null,              -- total client-facing charge
  currency text not null default 'UAH',
  platform_fee numeric(10,2) not null default 0,  -- our commission
  master_net numeric(10,2) not null default 0,    -- what goes to master on release

  -- State
  status payment_intent_status not null default 'pending',
  provider payment_provider not null default 'liqpay',
  provider_order_id text unique,              -- our own deterministic ID sent to provider
  provider_payment_id text,                   -- provider's id returned on success
  provider_signature text,                    -- last signature (for audit)

  -- Lifecycle timestamps
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  released_at timestamptz,
  captured_at timestamptz,
  refunded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 hour'),

  -- Free-form
  metadata jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists idx_payments_master on public.payment_intents(master_id, status);
create index if not exists idx_payments_client on public.payment_intents(client_id, status);
create index if not exists idx_payments_appointment on public.payment_intents(appointment_id) where appointment_id is not null;
create index if not exists idx_payments_auto_release on public.payment_intents(status, paid_at) where status = 'held';

-- Link back from appointments (deferred FK once payment_intents exists)
alter table public.appointments
  drop constraint if exists appointments_deposit_intent_fk;
alter table public.appointments
  add constraint appointments_deposit_intent_fk
    foreign key (deposit_intent_id) references public.payment_intents(id) on delete set null;

alter table public.payment_intents enable row level security;

-- Client sees only their own intents (if they have a linked profile)
drop policy if exists "pi_client_read" on public.payment_intents;
create policy "pi_client_read" on public.payment_intents
  for select using (
    client_id in (select id from public.clients where profile_id = auth.uid())
  );

-- Master sees their own
drop policy if exists "pi_master_read" on public.payment_intents;
create policy "pi_master_read" on public.payment_intents
  for select using (
    master_id in (select id from public.masters where profile_id = auth.uid())
  );

-- Writes happen only via service_role from our backend routes (no public write policy).

-- ─────────────────────────────────────────────────────────────
-- 4. platform_earnings — commission accumulator (for /superadmin/finance)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.platform_earnings (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete cascade,
  master_id uuid not null references public.masters(id) on delete cascade,
  gross_amount numeric(10,2) not null,
  fee_amount numeric(10,2) not null,
  fee_percent numeric(5,2) not null,
  currency text not null default 'UAH',
  earned_at timestamptz not null default now()
);

create index if not exists idx_platform_earnings_earned on public.platform_earnings(earned_at desc);

alter table public.platform_earnings enable row level security;

drop policy if exists "pe_superadmin_read" on public.platform_earnings;
create policy "pe_superadmin_read" on public.platform_earnings
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Platform config (global)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_config (key, value) values
  ('take_rate_percent', '1.5'::jsonb),
  ('auto_release_hours', '24'::jsonb),
  ('deposit_default_percent', '30'::jsonb)
on conflict (key) do nothing;

alter table public.platform_config enable row level security;

drop policy if exists "config_public_read" on public.platform_config;
create policy "config_public_read" on public.platform_config for select using (true);

drop policy if exists "config_superadmin_write" on public.platform_config;
create policy "config_superadmin_write" on public.platform_config
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid()
      and p.email in ('daniilpadalko97@gmail.com'))
  );

comment on table public.payment_intents is
  'Escrow state machine: pending → held → released/captured/refunded. Written only by backend routes; clients see via RLS.';
comment on table public.platform_earnings is
  'Immutable audit log of platform take-rate income. Populated on intent release. Only superadmin reads.';
