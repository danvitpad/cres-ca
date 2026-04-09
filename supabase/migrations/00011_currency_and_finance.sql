-- Currency rates cache
create table currency_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  rates jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Add purchase currency to inventory items
alter table inventory_items add column if not exists purchase_currency text default 'UAH';

-- Revenue goals
alter table masters add column if not exists monthly_revenue_goal numeric(10,2);

-- Recurring expenses
alter table expenses add column if not exists is_recurring boolean not null default false;
alter table expenses add column if not exists recurrence_interval text check (recurrence_interval in ('weekly', 'monthly', 'quarterly', 'yearly'));
alter table expenses add column if not exists next_recurrence_date date;

-- Tax rate for reports
alter table masters add column if not exists tax_rate_percent numeric(5,2) default 5.0;

alter table currency_rates enable row level security;
create policy "Anyone can read currency rates"
  on currency_rates for select
  using (true);
