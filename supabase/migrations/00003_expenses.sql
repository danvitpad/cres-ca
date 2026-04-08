-- Expenses table for tracking business costs
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid references masters(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  currency text not null default 'UAH',
  category text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Index for fast lookups by master and date range
create index idx_expenses_master_date on expenses(master_id, date);
create index idx_expenses_salon_date on expenses(salon_id, date);

-- RLS
alter table expenses enable row level security;

create policy "Masters can manage own expenses" on expenses
  for all using (
    master_id in (select id from masters where profile_id = auth.uid())
  );

create policy "Salon admins can manage salon expenses" on expenses
  for all using (
    salon_id in (select id from salons where owner_id = auth.uid())
  );
