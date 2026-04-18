-- Phase 2: Masters extension
-- Plan mapping: workspaces → masters (no workspaces table in this project).
-- Adds team_mode, commission/rent, specialties, and client-referral-program settings.

alter table masters
  add column if not exists team_mode text not null default 'solo'
    check (team_mode in ('solo', 'unified', 'marketplace')),
  add column if not exists commission_percent numeric(5,2),
  add column if not exists rent_amount numeric(10,2),
  add column if not exists specialties text[] default '{}',
  add column if not exists client_referral_enabled boolean not null default false,
  add column if not exists client_referral_reward_type text default 'discount_percent'
    check (client_referral_reward_type in ('discount_percent', 'discount_amount', 'bonus_points', 'free_service')),
  add column if not exists client_referral_reward_value numeric(10,2) default 10,
  add column if not exists client_referral_min_visits int default 1;

create index if not exists idx_masters_team_mode on masters(team_mode);
