-- --- YAML
-- name: Superadmin platform control
-- description: SUPERADMIN-PLAN Phase 1. platform_whitelist (free access override), platform_offers (campaigns), superadmin_audit_log.
-- created: 2026-04-19

-- 1. Whitelist: profile → free plan override
create table if not exists public.platform_whitelist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  master_id uuid references public.masters(id) on delete set null,
  salon_id uuid references public.salons(id) on delete set null,
  reason text,
  granted_plan text not null default 'business' check (granted_plan in ('starter', 'pro', 'business')),
  granted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(profile_id)
);

create index if not exists idx_platform_whitelist_profile on public.platform_whitelist(profile_id);
create index if not exists idx_platform_whitelist_expires on public.platform_whitelist(expires_at) where expires_at is not null;

alter table public.platform_whitelist enable row level security;

-- Only server-role reads/writes (no public-user access)
drop policy if exists "superadmin whitelist read" on public.platform_whitelist;
create policy "superadmin whitelist read"
  on public.platform_whitelist for select
  using (false);

-- 2. Offers: campaigns / promo pushes
create table if not exists public.platform_offers (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null,
  description jsonb,
  offer_type text not null check (offer_type in ('discount_percent', 'discount_fixed', 'free_months', 'plan_upgrade')),
  offer_value numeric not null,
  target_type text not null check (target_type in ('all_masters', 'all_salons', 'specific', 'segment')),
  target_ids uuid[],
  target_segment jsonb,
  delivery_channels text[] not null default array['email', 'telegram', 'in_app']::text[],
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  promo_code text unique,
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count integer not null default 0,
  conversions_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_offers_status on public.platform_offers(status, created_at desc);
create index if not exists idx_platform_offers_promo on public.platform_offers(promo_code) where promo_code is not null;

alter table public.platform_offers enable row level security;

drop policy if exists "superadmin offers read" on public.platform_offers;
create policy "superadmin offers read"
  on public.platform_offers for select
  using (false);

-- 3. Audit log: every superadmin action
create table if not exists public.superadmin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_superadmin_audit on public.superadmin_audit_log(admin_profile_id, created_at desc);
create index if not exists idx_superadmin_audit_target on public.superadmin_audit_log(target_type, target_id, created_at desc);

alter table public.superadmin_audit_log enable row level security;

drop policy if exists "superadmin audit read" on public.superadmin_audit_log;
create policy "superadmin audit read"
  on public.superadmin_audit_log for select
  using (false);
