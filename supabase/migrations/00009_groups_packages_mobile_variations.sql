-- 19.3: Group bookings
alter table services add column if not exists is_group boolean not null default false;
alter table services add column if not exists max_participants int default 1;
alter table services add column if not exists min_participants int default 1;
alter table appointments add column if not exists group_session_id uuid;

create table group_sessions (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references masters(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_participants int not null,
  current_participants int not null default 0,
  status text not null default 'open' check (status in ('open', 'full', 'confirmed', 'cancelled', 'completed')),
  min_participants int not null default 1,
  auto_cancel_if_below_min boolean not null default true,
  created_at timestamptz not null default now()
);

alter table group_sessions enable row level security;
create policy "Masters manage own group sessions"
  on group_sessions for all
  using (master_id in (select id from masters where profile_id = auth.uid()));

-- 19.4: Service packages
create table service_packages (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references masters(id) on delete cascade,
  name text not null,
  description text,
  service_id uuid references services(id) on delete cascade,
  total_visits int not null,
  bonus_visits int not null default 0,
  price numeric(10,2) not null,
  currency text not null default 'UAH',
  validity_days int not null default 90,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  package_id uuid references service_packages(id) on delete cascade,
  visits_remaining int not null,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  payment_id uuid references payments(id)
);

alter table service_packages enable row level security;
alter table client_packages enable row level security;

create policy "Masters manage own packages"
  on service_packages for all
  using (master_id in (select id from masters where profile_id = auth.uid()));

create policy "Clients can view their packages"
  on client_packages for select
  using (client_id in (select id from clients where profile_id = auth.uid()));

-- 19.5: Mobile masters
alter table masters add column if not exists is_mobile boolean not null default false;
alter table masters add column if not exists service_radius_km int default 15;
alter table masters add column if not exists travel_fee_fixed numeric(10,2) default 0;
alter table masters add column if not exists travel_fee_per_km numeric(10,2) default 0;
alter table appointments add column if not exists client_address text;
alter table appointments add column if not exists client_lat double precision;
alter table appointments add column if not exists client_lng double precision;
alter table appointments add column if not exists travel_time_minutes int;

-- 19.6: Price variations
create table service_variations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  duration_minutes int not null,
  sort_order int not null default 0
);

alter table service_variations enable row level security;
create policy "Masters manage own service variations"
  on service_variations for all
  using (
    service_id in (
      select s.id from services s
      join masters m on s.master_id = m.id
      where m.profile_id = auth.uid()
    )
  );
