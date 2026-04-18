-- Phase 2: material_transactions (history of inventory movement)
-- Plan mapping: workspace_id → master_id (project is master-centric, no workspaces).
-- Coexists with legacy inventory_usage table — new auto-logic writes here;
-- inventory_usage remains for existing Voice AI regex path (backward-compatible).

create table if not exists material_transactions (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid not null references masters(id) on delete cascade,
  material_id uuid not null references inventory_items(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjustment', 'reversal')),
  quantity numeric(10,3) not null,
  related_appointment_id uuid references appointments(id) on delete set null,
  related_supplier_order_id uuid, -- FK added in 00048
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_material_transactions_material on material_transactions(material_id, created_at desc);
create index if not exists idx_material_transactions_appointment on material_transactions(related_appointment_id);
create index if not exists idx_material_transactions_master on material_transactions(master_id, created_at desc);

alter table material_transactions enable row level security;

create policy "Master manages own material_transactions"
  on material_transactions for all
  using (master_id in (select id from masters where profile_id = auth.uid()))
  with check (master_id in (select id from masters where profile_id = auth.uid()));
