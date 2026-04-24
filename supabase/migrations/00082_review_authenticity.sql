/** --- YAML
 * name: 00082_review_authenticity
 * description: Reviews authenticity — only clients with completed appointment can review; trigger blocks fakes.
 *              Matches the polymorphic prod schema: reviewer_id + target_id + target_type.
 *              (Note: initial_schema.sql has reviewer_profile_id/target_master_id, but prod was renamed.)
 * created: 2026-04-24
 * --- */

-- 1. Track when review was requested (for cron loop) and when submitted
alter table public.appointments
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_submitted_at timestamptz;

create index if not exists idx_appointments_review_pending
  on public.appointments(ends_at)
  where status = 'completed' and review_requested_at is null;

-- 2. Trigger that validates every review insert/update
create or replace function public.enforce_review_authenticity()
returns trigger
language plpgsql
as $$
declare
  v_appt record;
begin
  -- Must reference an appointment
  if new.appointment_id is null then
    raise exception 'Review must reference an appointment';
  end if;

  select a.status, a.client_id, a.master_id, a.ends_at, c.profile_id as client_profile_id
  into v_appt
  from public.appointments a
  join public.clients c on c.id = a.client_id
  where a.id = new.appointment_id;

  if not found then
    raise exception 'Appointment % not found', new.appointment_id;
  end if;

  -- Only completed appointments can be reviewed
  if v_appt.status != 'completed' then
    raise exception 'Reviews are only allowed for completed appointments (current status: %)', v_appt.status;
  end if;

  -- At least 30 minutes after the appointment ends
  if v_appt.ends_at > now() - interval '30 minutes' then
    raise exception 'Review can be submitted 30 minutes after the appointment ends';
  end if;

  -- Reviewer must own the appointment (be the client's auth profile)
  if new.target_type = 'master' then
    if new.reviewer_id is null or new.reviewer_id != v_appt.client_profile_id then
      raise exception 'Only the client who attended can review the master';
    end if;
    if new.target_id is null or new.target_id != v_appt.master_id then
      raise exception 'target_id mismatch with appointment master';
    end if;
  end if;

  -- One review per (reviewer, appointment)
  if exists (
    select 1 from public.reviews
    where appointment_id = new.appointment_id
      and reviewer_id = new.reviewer_id
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'You already reviewed this appointment';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_review_authenticity on public.reviews;
create trigger trg_enforce_review_authenticity
  before insert or update on public.reviews
  for each row execute function public.enforce_review_authenticity();

-- 3. Make sure RLS public-read is in place (redundant with 00073, kept idempotent)
alter table public.reviews enable row level security;

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (is_published = true);
