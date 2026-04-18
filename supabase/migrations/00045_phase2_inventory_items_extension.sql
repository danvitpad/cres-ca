-- Phase 2: inventory_items extension + suppliers bootstrap
-- Plan mapping: materials → inventory_items.
-- NOTE: remote DB does not have `suppliers` table (local migration 00028 block_h never applied
-- to this project). Creating suppliers inline here so that supplier_orders + preferred_supplier_id
-- FK have a valid target.
-- NOTE: cost_per_unit and low_stock_threshold already exist from 00001_initial_schema.
-- NOTE: `quantity` stays as canonical stock column (12 callers including Voice AI webhook).

create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid not null references masters(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  website text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_master on suppliers(master_id);

alter table suppliers enable row level security;

create policy "Masters manage own suppliers"
  on suppliers for all
  using (master_id in (select id from masters where profile_id = auth.uid()))
  with check (master_id in (select id from masters where profile_id = auth.uid()));

alter table inventory_items
  add column if not exists preferred_supplier_id uuid references suppliers(id) on delete set null;

create index if not exists idx_inventory_supplier on inventory_items(preferred_supplier_id);
