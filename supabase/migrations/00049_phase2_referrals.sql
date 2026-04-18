-- Phase 2: referrals extension (client→client and master→master)
-- Plan mapping: workspace_id → master_id; user_id → profile_id.
-- NOTE: remote DB already has a simpler `referrals` table (id, referrer_client_id,
-- referred_client_id, bonus_points, created_at) from legacy migration. We ALTER it
-- additively so existing inserts in invite/claim and client pages keep working.

alter table referrals
  add column if not exists type text default 'client_to_client'
    check (type in ('client_to_client', 'master_to_master')),
  add column if not exists master_id uuid references masters(id) on delete cascade,
  add column if not exists referrer_master_profile_id uuid references profiles(id) on delete set null,
  add column if not exists referred_master_profile_id uuid references profiles(id) on delete set null,
  add column if not exists code text unique default encode(gen_random_bytes(6), 'hex'),
  add column if not exists status text default 'pending'
    check (status in ('pending', 'confirmed', 'rewarded', 'cancelled')),
  add column if not exists reward_type text,
  add column if not exists reward_value numeric(10,2),
  add column if not exists tracked_subscription_months int not null default 0,
  add column if not exists total_commission_paid numeric(10,2) not null default 0,
  add column if not exists confirmed_at timestamptz;

create index if not exists idx_referrals_code on referrals(code);
create index if not exists idx_referrals_master on referrals(master_id);
create index if not exists idx_referrals_referrer_master on referrals(referrer_master_profile_id);

-- Ensure RLS is enabled (may already be)
alter table referrals enable row level security;

-- Drop legacy permissive policies if any, then install master-centric policies.
-- Keep client-side INSERTs working: client-app can insert rows tied to their own clients.
drop policy if exists "Master manages own client referrals" on referrals;
create policy "Master manages own client referrals"
  on referrals for all
  using (
    (coalesce(type, 'client_to_client') = 'client_to_client' and (
      master_id in (select id from masters where profile_id = auth.uid())
      or referrer_client_id in (select id from clients where profile_id = auth.uid())
      or referred_client_id in (select id from clients where profile_id = auth.uid())
    ))
    or
    (type = 'master_to_master' and (
      referrer_master_profile_id = auth.uid() or referred_master_profile_id = auth.uid()
    ))
  )
  with check (
    (coalesce(type, 'client_to_client') = 'client_to_client' and (
      master_id in (select id from masters where profile_id = auth.uid())
      or referrer_client_id in (select id from clients where profile_id = auth.uid())
      or referred_client_id in (select id from clients where profile_id = auth.uid())
    ))
    or
    (type = 'master_to_master' and referrer_master_profile_id = auth.uid())
  );
