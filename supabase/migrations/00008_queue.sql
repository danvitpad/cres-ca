-- Live queue for walk-in mode
create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references masters(id) on delete cascade,
  client_id uuid references clients(id),
  client_name text,
  service_id uuid references services(id),
  position int not null,
  status text not null default 'waiting' check (status in ('waiting', 'in_service', 'completed', 'cancelled', 'no_show')),
  estimated_start timestamptz,
  joined_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index idx_queue_master_status on queue_entries(master_id, status);

alter table queue_entries enable row level security;

create policy "Masters can manage their queue"
  on queue_entries for all
  using (master_id in (select id from masters where profile_id = auth.uid()));

-- Queue mode setting
alter table masters add column if not exists queue_mode boolean not null default false;
