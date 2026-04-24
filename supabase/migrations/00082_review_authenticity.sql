/** --- YAML
 * name: 00082_review_authenticity
 * description: Reviews могут оставлять только клиенты с completed appointment. Cron-ready: appointments.review_requested_at отмечает когда клиенту послали запрос на отзыв после визита. Prevents review spam / fakes.
 * created: 2026-04-24
 * --- */

-- 1. Track when review was requested (for cron loop)
alter table public.appointments
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_submitted_at timestamptz;

create index if not exists idx_appointments_review_pending
  on public.appointments(ends_at)
  where status = 'completed' and review_requested_at is null;

-- 2. Reviews already has appointment_id FK. Enforce: must be tied to a completed, own appointment.
-- We enforce via RLS and a trigger that blocks stray insertions.
create or replace function public.enforce_review_authenticity()
returns trigger
language plpgsql
as $$
declare
  v_appt record;
begin
  -- Every review MUST have an appointment_id
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
    raise exception 'Reviews are only allowed for completed appointments (current: %)', v_appt.status;
  end if;

  -- At least 30 minutes after the appointment ends (prevent instant fake reviews)
  if v_appt.ends_at > now() - interval '30 minutes' then
    raise exception 'Review can be submitted 30 minutes after the appointment ends';
  end if;

  -- Reviewer must own the appointment (either they're the client's profile OR the master)
  if new.target_type = 'master' then
    if new.reviewer_profile_id is null or new.reviewer_profile_id != v_appt.client_profile_id then
      raise exception 'Only the client who attended can review the master';
    end if;
    if new.target_master_id is null or new.target_master_id != v_appt.master_id then
      raise exception 'target_master_id mismatch with appointment';
    end if;
  end if;

  -- One review per (reviewer, appointment)
  if exists (
    select 1 from public.reviews
    where appointment_id = new.appointment_id
      and reviewer_profile_id = new.reviewer_profile_id
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

-- 3. RLS on reviews — if not already set
alter table public.reviews enable row level security;

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (is_published = true);

drop policy if exists "reviews_own_insert" on public.reviews;
create policy "reviews_own_insert" on public.reviews
  for insert with check (
    reviewer_profile_id = auth.uid()
  );

drop policy if exists "reviews_own_update" on public.reviews;
create policy "reviews_own_update" on public.reviews
  for update using (reviewer_profile_id = auth.uid());
