-- Phase 3B: "Under the hood" automation
-- - auto-deduct service_materials from inventory_items on appointment completion
-- - reversal on cancellation
-- - auto-update client segment (tier) on appointment insert/update
-- - margin + period metrics views
-- - all automations log to ai_actions_log with source='automation'

-- Extend client_tier_t enum with 'sleeping' value (if not present)
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'client_tier_t' and e.enumlabel = 'sleeping'
  ) then
    alter type client_tier_t add value 'sleeping';
  end if;
end$$;

-- ============================================================
-- AUTO-DEDUCT MATERIALS ON APPOINTMENT COMPLETION
-- ============================================================

create or replace function auto_deduct_service_materials()
returns trigger as $$
declare
  recipe_row record;
  log_result jsonb := '[]'::jsonb;
  deducted_count int := 0;
begin
  -- Only fire when status transitions TO 'completed'
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    for recipe_row in
      select sm.material_id, sm.quantity, sm.unit, i.name, i.quantity as current_qty
      from service_materials sm
      join inventory_items i on i.id = sm.material_id
      where sm.service_id = new.service_id and sm.is_optional = false
    loop
      -- Insert transaction record
      insert into material_transactions (master_id, material_id, type, quantity, related_appointment_id, note, created_by)
      values (new.master_id, recipe_row.material_id, 'out', recipe_row.quantity, new.id,
              'auto: ' || recipe_row.name, null);

      -- Decrement stock
      update inventory_items
        set quantity = greatest(0, quantity - recipe_row.quantity), updated_at = now()
        where id = recipe_row.material_id;

      log_result := log_result || jsonb_build_object(
        'material_id', recipe_row.material_id,
        'material_name', recipe_row.name,
        'quantity_out', recipe_row.quantity,
        'unit', recipe_row.unit
      );
      deducted_count := deducted_count + 1;
    end loop;

    if deducted_count > 0 then
      insert into ai_actions_log (master_id, source, action_type, input_text, result, related_client_id, related_appointment_id, status)
      values (new.master_id, 'automation', 'materials_deducted', null,
              jsonb_build_object('materials', log_result, 'count', deducted_count),
              new.client_id, new.id, 'success');
    end if;
  end if;

  -- Reversal on cancellation of previously completed appointment
  if new.status = 'cancelled' and old.status = 'completed' then
    for recipe_row in
      select mt.id, mt.material_id, mt.quantity, i.name
      from material_transactions mt
      join inventory_items i on i.id = mt.material_id
      where mt.related_appointment_id = new.id and mt.type = 'out'
    loop
      insert into material_transactions (master_id, material_id, type, quantity, related_appointment_id, note, created_by)
      values (new.master_id, recipe_row.material_id, 'reversal', recipe_row.quantity, new.id,
              'reversal: appointment cancelled', null);

      update inventory_items
        set quantity = quantity + recipe_row.quantity, updated_at = now()
        where id = recipe_row.material_id;
    end loop;

    insert into ai_actions_log (master_id, source, action_type, input_text, result, related_client_id, related_appointment_id, status)
    values (new.master_id, 'automation', 'materials_reversed', null,
            jsonb_build_object('reason', 'appointment_cancelled'),
            new.client_id, new.id, 'success');
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_deduct_service_materials on appointments;
create trigger trg_auto_deduct_service_materials
  after update of status on appointments
  for each row execute function auto_deduct_service_materials();

-- ============================================================
-- AUTO-UPDATE CLIENT SEGMENT (tier)
-- Rules:
--  vip:      total_visits >= 10  OR  total_spent >= 10000 over last 180 days
--  regular:  total_visits >= 3   AND last_visit within 90 days
--  sleeping: total_visits >= 1   AND last_visit older than 90 days
--  new:      total_visits < 3    AND last_visit within 90 days (or null)
-- ============================================================

create or replace function compute_client_tier(p_client_id uuid)
returns client_tier_t as $$
declare
  v_visits int;
  v_spent numeric;
  v_last_visit timestamptz;
  v_days_since int;
  v_recent_spent numeric;
begin
  select total_visits, total_spent, last_visit_at
    into v_visits, v_spent, v_last_visit
    from clients where id = p_client_id;

  if v_visits is null or v_visits = 0 then
    return 'new'::client_tier_t;
  end if;

  select coalesce(sum(price), 0) into v_recent_spent
    from appointments
    where client_id = p_client_id
      and status = 'completed'
      and starts_at >= now() - interval '180 days';

  if v_visits >= 10 or v_recent_spent >= 10000 then
    return 'vip'::client_tier_t;
  end if;

  v_days_since := case when v_last_visit is null then 9999 else extract(day from (now() - v_last_visit))::int end;

  if v_visits >= 3 and v_days_since <= 90 then
    return 'regular'::client_tier_t;
  end if;

  if v_days_since > 90 then
    return 'sleeping'::client_tier_t;
  end if;

  return 'new'::client_tier_t;
end;
$$ language plpgsql stable;

create or replace function update_client_tier_on_appointment()
returns trigger as $$
declare
  v_new_tier client_tier_t;
  v_old_tier client_tier_t;
begin
  select tier into v_old_tier from clients where id = new.client_id;
  v_new_tier := compute_client_tier(new.client_id);

  if v_new_tier is distinct from v_old_tier then
    update clients set tier = v_new_tier, updated_at = now() where id = new.client_id;

    insert into ai_actions_log (master_id, source, action_type, result, related_client_id, status)
    values (new.master_id, 'automation', 'client_tier_updated',
            jsonb_build_object('from', v_old_tier::text, 'to', v_new_tier::text),
            new.client_id, 'success');
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_update_client_tier_on_appointment on appointments;
create trigger trg_update_client_tier_on_appointment
  after insert or update of status, starts_at on appointments
  for each row execute function update_client_tier_on_appointment();

-- ============================================================
-- VIEWS — service margin + master period metrics
-- ============================================================

create or replace view service_current_margin as
select
  s.id as service_id,
  s.master_id,
  s.name,
  s.price,
  s.currency,
  coalesce(sum(sm.quantity * coalesce(i.cost_per_unit, 0)), 0) as cost,
  s.price - coalesce(sum(sm.quantity * coalesce(i.cost_per_unit, 0)), 0) as margin,
  case when s.price > 0
    then round(((s.price - coalesce(sum(sm.quantity * coalesce(i.cost_per_unit, 0)), 0)) / s.price * 100)::numeric, 2)
    else null
  end as margin_percent
from services s
left join service_materials sm on sm.service_id = s.id and sm.is_optional = false
left join inventory_items i on i.id = sm.material_id
group by s.id, s.master_id, s.name, s.price, s.currency;

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
stable
as $$
  with rev as (
    select coalesce(sum(price), 0)::numeric as total, count(*)::bigint as cnt
      from appointments
      where master_id = p_master_id and status = 'completed'
        and starts_at >= p_start and starts_at < p_end
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
    rev.total as revenue,
    exp.total as expenses,
    (rev.total - exp.total) as profit,
    rev.cnt as appointments_count,
    case when rev.cnt > 0 then round((rev.total / rev.cnt)::numeric, 2) else 0 end as avg_check,
    new_cli.cnt as new_clients_count
  from rev, exp, new_cli;
$$;
