/** --- YAML
 * name: 00079_robust_auth_trigger
 * description: Replace handle_new_user() with an error-resilient version. Previously any failure in the side-effect inserts (salon / master / subscription) aborted auth.users insert → 500 on /auth/v1/signup. Now each side-effect is wrapped in BEGIN/EXCEPTION so the core profile is always created; failures are logged to signup_trigger_errors for superadmin review.
 * created: 2026-04-21
 * --- */

-- 1. Diagnostic log table — one row per side-effect error during signup.
create table if not exists public.signup_trigger_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  step text not null,             -- 'profile' | 'master' | 'salon' | 'subscription'
  sqlstate text,
  error_message text,
  raw_meta jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.signup_trigger_errors enable row level security;

drop policy if exists "superadmin signup_errors read" on public.signup_trigger_errors;
create policy "superadmin signup_errors read"
  on public.signup_trigger_errors for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.email in ('daniilpadalko97@gmail.com')
    )
  );

-- 2. Robust trigger. Strategy:
--    - Profile insert MUST succeed. If it fails we still return NEW so auth.users row persists;
--      we log the error and the user can complete onboarding later (support can create profile manually).
--    - Side-effect inserts (masters / salons / subscription) each wrapped in a nested block.
--      A failure logs a row to signup_trigger_errors but does NOT abort signup.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role user_role;
  v_full_name text;
  v_phone text;
  v_new_salon_id uuid;
begin
  -- Resolve inputs (defensive casts)
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'client');
  exception when others then
    v_role := 'client';
  end;
  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), '');
  v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');

  -- Step 1: profile (core)
  begin
    insert into public.profiles (id, role, full_name, phone, email)
    values (new.id, v_role, v_full_name, v_phone, new.email);
  exception when others then
    insert into public.signup_trigger_errors (user_id, step, sqlstate, error_message, raw_meta)
    values (new.id, 'profile', sqlstate, sqlerrm, new.raw_user_meta_data);
    return new;  -- give up on side-effects if profile itself failed
  end;

  -- Step 2: master row (if master or salon_admin)
  if v_role in ('master', 'salon_admin') then
    begin
      if v_role = 'salon_admin' then
        -- create salon first, then master linked to it
        insert into public.salons (owner_id, name)
        values (new.id, coalesce(nullif(v_full_name, ''), 'My Salon'))
        returning id into v_new_salon_id;

        insert into public.masters (profile_id, salon_id)
        values (new.id, v_new_salon_id);
      else
        insert into public.masters (profile_id)
        values (new.id);
      end if;
    exception when others then
      insert into public.signup_trigger_errors (user_id, step, sqlstate, error_message, raw_meta)
      values (new.id, 'master_or_salon', sqlstate, sqlerrm, new.raw_user_meta_data);
    end;
  end if;

  -- Step 3: trial subscription (14 days)
  begin
    insert into public.subscriptions (profile_id, tier, status, trial_ends_at, current_period_end)
    values (new.id, 'trial', 'active', now() + interval '14 days', now() + interval '14 days');
  exception when others then
    insert into public.signup_trigger_errors (user_id, step, sqlstate, error_message, raw_meta)
    values (new.id, 'subscription', sqlstate, sqlerrm, new.raw_user_meta_data);
  end;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Ensure trigger still attached (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on table public.signup_trigger_errors is
  'Diagnostic log: captures exceptions from handle_new_user() side-effects (masters / salons / subscriptions). If a signup 500s, first place to look.';
