-- --- YAML
-- name: Referral codes + bonus transactions ledger
-- description: Mega-plan Phase 8. Adds profiles.referral_code (unique auto-generated) and
--              bonus_transactions append-only ledger. Backfills codes for existing profiles.
--              Does NOT replace legacy wallet_transactions or referrals — lives alongside.
-- created: 2026-04-19

-- 1. Profile referral codes
alter table public.profiles
  add column if not exists referral_code text unique;

create or replace function public.gen_referral_code() returns text
language sql volatile as $$
  select lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

create or replace function public.ensure_referral_code() returns trigger
language plpgsql as $$
begin
  if new.referral_code is null or length(new.referral_code) = 0 then
    new.referral_code := public.gen_referral_code();
    -- Loop on collision (very rare for 8 hex chars)
    while exists (select 1 from public.profiles where referral_code = new.referral_code and id <> new.id) loop
      new.referral_code := public.gen_referral_code();
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_referral_code on public.profiles;
create trigger trg_ensure_referral_code
  before insert or update on public.profiles
  for each row execute function public.ensure_referral_code();

-- Backfill existing rows
update public.profiles
set referral_code = public.gen_referral_code()
where referral_code is null;

-- 2. Bonus transactions ledger
create table if not exists public.bonus_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'referral_signup',       -- got bonus for new user registering via my link
    'referral_welcome',      -- got bonus for signing up via someone else's link
    'booking_discount',      -- spent bonuses for appointment discount
    'subscription_discount', -- spent bonuses for subscription discount
    'profile_boost',         -- spent bonuses for profile boost
    'commission',            -- master→master: % of referred master's subscription
    'adjustment',            -- manual admin adjustment
    'expired'                -- time-based expiry
  )),
  amount numeric(12,2) not null,
  balance_after numeric(12,2),
  reference_id uuid,
  reference_kind text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bonus_tx_profile on public.bonus_transactions(profile_id, created_at desc);
create index if not exists idx_bonus_tx_kind on public.bonus_transactions(kind);

alter table public.bonus_transactions enable row level security;

drop policy if exists "own bonus transactions read" on public.bonus_transactions;
create policy "own bonus transactions read"
  on public.bonus_transactions for select
  using (profile_id = auth.uid());

-- Server-role inserts only (no client-side insert policy).
