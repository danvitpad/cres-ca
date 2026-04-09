-- Recurring bookings
create table recurring_bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  master_id uuid references masters(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  interval_days int not null,
  preferred_day_of_week int,
  preferred_time time,
  next_booking_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_recurring_active on recurring_bookings(is_active, next_booking_date);

alter table recurring_bookings enable row level security;

create policy "Masters can manage recurring bookings"
  on recurring_bookings for all
  using (master_id in (select id from masters where profile_id = auth.uid()));
