-- Products storefront
create table products (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references masters(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null,
  currency text not null default 'UAH',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_recommendations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  message_template text
);

create table product_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  quantity int not null default 1,
  total_price numeric(10,2) not null,
  payment_id uuid references payments(id),
  status text not null default 'pending' check (status in ('pending', 'paid', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table products enable row level security;
alter table product_recommendations enable row level security;
alter table product_orders enable row level security;

create policy "Masters manage own products"
  on products for all
  using (master_id in (select id from masters where profile_id = auth.uid()));

create policy "Authenticated users can view active products"
  on products for select
  using (is_active = true);

create policy "Masters manage own product recommendations"
  on product_recommendations for all
  using (product_id in (select id from products where master_id in (select id from masters where profile_id = auth.uid())));

create policy "Clients manage own orders"
  on product_orders for all
  using (client_id in (select id from clients where profile_id = auth.uid()));

-- Burning slots settings
alter table masters add column if not exists burning_slots_enabled boolean default false;
alter table masters add column if not exists burning_slots_discount int default 20;
