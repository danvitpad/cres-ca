-- BLOCK H: Inventory & Products enhancements
-- H1: Product sale support (stock on products table)
-- H2: Low stock alerts for products
-- H3: Supplier management
-- H4: Barcode scan support (image_url on inventory_items)

-- ============================================================
-- H1 + H2: Add stock columns to products table
-- ============================================================

alter table products add column if not exists stock int not null default 0;
alter table products add column if not exists min_stock int not null default 0;
alter table products add column if not exists barcode text;
alter table products add column if not exists sku text;

-- Note: payment_type enum extension for 'product_sale' must be done
-- outside a transaction. Use Supabase SQL editor or a separate migration
-- with `SET LOCAL lock_timeout = '4s';` if needed.
-- For now, product sales use type 'full' with description prefix '[PRODUCT] '.

-- ============================================================
-- H3: Suppliers table
-- ============================================================

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references masters(id) on delete cascade,
  name text not null,
  contact_phone text,
  contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table suppliers enable row level security;

create policy "Masters manage own suppliers"
  on suppliers for all
  using (master_id in (select id from masters where profile_id = auth.uid()));

-- Add supplier FK to products
alter table products add column if not exists supplier_id uuid references suppliers(id) on delete set null;

-- ============================================================
-- H4: image_url on inventory_items (used by barcode scan page)
-- ============================================================

alter table inventory_items add column if not exists image_url text;
