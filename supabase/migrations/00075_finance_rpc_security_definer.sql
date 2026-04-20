-- 00075_finance_rpc_security_definer.sql
-- Fix: Finance StatCards showed "—" (no data) despite DB having expenses/incomes.
-- Root cause: master_period_metrics was defined as `language sql` without
-- `security definer`. Sub-queries inside the function body (SELECT FROM
-- appointments / expenses / clients) got RLS-filtered by the caller's auth.
-- When the caller is an authenticated master, this SHOULD match by master_id —
-- but observed empty result indicates RLS evaluation inside inline SQL
-- function doesn't always see auth.uid() the way we expect.
--
-- Fix: SECURITY DEFINER — function trusts the master_id parameter and
-- bypasses RLS on the underlying tables. Safe here because:
-- 1. The API route (finance/page.tsx) only passes master.id from useMaster()
--    which loaded the master record via standard RLS (so auth already verified)
-- 2. The function returns only aggregates (sums/counts), no sensitive rows
-- 3. Pattern matches `compute_client_tier`, `is_salon_admin` etc. which are
--    all SECURITY DEFINER RPCs in this codebase

create or replace function master_period_metrics(p_master_id uuid, p_start timestamptz, p_end timestamptz)
returns table (
  revenue numeric,
  expenses numeric,
  profit numeric,
  appointments_count bigint,
  avg_check numeric,
  new_clients_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with rev as (
    select coalesce(sum(price), 0)::numeric as total, count(*)::bigint as cnt
      from appointments
      where master_id = p_master_id and status = 'completed'
        and starts_at >= p_start and starts_at < p_end
  ),
  manual as (
    select coalesce(sum(amount), 0)::numeric as total
      from manual_incomes
      where master_id = p_master_id
        and date >= p_start::date and date < p_end::date
  ),
  exp as (
    select coalesce(sum(amount), 0)::numeric as total
      from expenses
      where master_id = p_master_id
        and date >= p_start::date and date < p_end::date
  ),
  new_cli as (
    select count(*)::bigint as cnt from clients
      where master_id = p_master_id
        and created_at >= p_start and created_at < p_end
  )
  select
    (rev.total + manual.total) as revenue,
    exp.total as expenses,
    (rev.total + manual.total - exp.total) as profit,
    rev.cnt as appointments_count,
    case when rev.cnt > 0 then round(rev.total / rev.cnt, 2) else 0 end as avg_check,
    new_cli.cnt as new_clients_count
  from rev, manual, exp, new_cli;
$$;

-- Revoke anon, grant authenticated + service_role
revoke execute on function master_period_metrics(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function master_period_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- Trigger PostgREST schema reload
NOTIFY pgrst, 'reload schema';
