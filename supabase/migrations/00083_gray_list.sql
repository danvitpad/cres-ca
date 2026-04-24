/** --- YAML
 * name: 00083_gray_list
 * description: Auto-increment clients.no_show_count via trigger on appointments.status transitions → no_show. Also decrements on revert (no_show → cancelled/completed). Prepares require_deposit flag for Phase 2 escrow.
 * created: 2026-04-24
 * --- */

-- 1. Ensure columns exist (no_show_count already from schema 00001; added here for safety)
alter table public.clients
  add column if not exists no_show_count int not null default 0,
  add column if not exists require_deposit_override boolean;  -- null = use master default, true/false = explicit

alter table public.masters
  add column if not exists require_deposit_after_no_show int not null default 2;  -- after N no-shows, auto require deposit

-- 2. Trigger: maintain no_show_count
create or replace function public.sync_no_show_count()
returns trigger
language plpgsql
as $$
begin
  -- Only care about status changes (UPDATE) or fresh inserts with no_show status
  if (tg_op = 'INSERT' and new.status = 'no_show') then
    update public.clients set no_show_count = no_show_count + 1 where id = new.client_id;
    return new;
  end if;

  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    if new.status = 'no_show' and old.status != 'no_show' then
      update public.clients set no_show_count = no_show_count + 1 where id = new.client_id;
    elsif old.status = 'no_show' and new.status != 'no_show' then
      -- Revert (e.g. master corrected the status)
      update public.clients set no_show_count = greatest(0, no_show_count - 1) where id = new.client_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_no_show_count on public.appointments;
create trigger trg_sync_no_show_count
  after insert or update on public.appointments
  for each row execute function public.sync_no_show_count();

-- 3. Backfill (one-time idempotent recount)
with counts as (
  select client_id, count(*)::int as n
  from public.appointments
  where status = 'no_show'
  group by client_id
)
update public.clients c
set no_show_count = coalesce(counts.n, 0)
from counts
where c.id = counts.client_id;

-- 4. Helper: check if deposit is required for (master, client)
create or replace function public.is_deposit_required(
  p_master_id uuid,
  p_client_id uuid
)
returns boolean
language sql
stable
as $$
  with client_info as (
    select no_show_count, require_deposit_override
    from public.clients where id = p_client_id
  ),
  master_info as (
    select require_deposit_after_no_show
    from public.masters where id = p_master_id
  )
  select coalesce(
    (select require_deposit_override from client_info),
    (select no_show_count from client_info) >= (select require_deposit_after_no_show from master_info),
    false
  );
$$;

grant execute on function public.is_deposit_required(uuid, uuid) to authenticated, service_role;

comment on column public.clients.no_show_count is 'Automatically maintained by trg_sync_no_show_count. Clients with no_show_count >= master.require_deposit_after_no_show are flagged as gray-listed in UI.';
