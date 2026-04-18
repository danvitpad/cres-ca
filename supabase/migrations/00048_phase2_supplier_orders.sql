-- Phase 2: supplier_orders
-- Plan mapping: workspace_id → master_id.

create table if not exists supplier_orders (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid not null references masters(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'confirmed', 'delivered', 'cancelled')),
  items jsonb not null default '[]'::jsonb,
  total_cost numeric(10,2) not null default 0,
  currency text not null default 'UAH',
  sent_via text,
  sent_at timestamptz,
  delivered_at timestamptz,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_orders_master on supplier_orders(master_id, created_at desc);
create index if not exists idx_supplier_orders_status on supplier_orders(status);
create index if not exists idx_supplier_orders_supplier on supplier_orders(supplier_id);

-- Late-bind FK on material_transactions.related_supplier_order_id now that supplier_orders exists
alter table material_transactions
  add constraint material_transactions_supplier_order_fk
  foreign key (related_supplier_order_id) references supplier_orders(id) on delete set null;

alter table supplier_orders enable row level security;

create policy "Master manages own supplier_orders"
  on supplier_orders for all
  using (master_id in (select id from masters where profile_id = auth.uid()))
  with check (master_id in (select id from masters where profile_id = auth.uid()));
