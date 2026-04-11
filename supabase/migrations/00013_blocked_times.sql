-- Blocked time slots (lunch breaks, personal time, etc.)
create table if not exists blocked_times (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references masters(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text, -- optional: "Обед", "Личное", etc.
  created_at timestamptz not null default now()
);

create index idx_blocked_times_master on blocked_times(master_id);
create index idx_blocked_times_range on blocked_times(starts_at, ends_at);

-- RLS
alter table blocked_times enable row level security;

create policy "Masters can manage own blocked times"
  on blocked_times for all
  using (master_id in (select id from masters where profile_id = auth.uid()))
  with check (master_id in (select id from masters where profile_id = auth.uid()));
