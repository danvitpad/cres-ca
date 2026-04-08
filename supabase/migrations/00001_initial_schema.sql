-- ============================================================
-- CRES-CA Database Schema
-- Universal Service Booking CRM
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('client', 'master', 'salon_admin', 'receptionist');
create type subscription_tier as enum ('trial', 'starter', 'pro', 'business');
create type subscription_status as enum ('active', 'past_due', 'cancelled', 'expired');
create type appointment_status as enum ('booked', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
create type behavior_indicator as enum ('frequent_canceller', 'often_late', 'rude', 'excellent');
create type notification_channel as enum ('telegram', 'email', 'push');
create type notification_status as enum ('pending', 'sent', 'failed');
create type payment_status as enum ('pending', 'completed', 'refunded', 'failed');
create type payment_type as enum ('prepayment', 'full', 'refund', 'subscription');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null default '',
  phone text,
  avatar_url text,
  locale text not null default 'uk',
  timezone text not null default 'Europe/Kyiv',
  telegram_id bigint unique,
  telegram_username text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SALONS
-- ============================================================

create table salons (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  phone text,
  email text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  logo_url text,
  cover_url text,
  working_hours jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  -- either a master (profile) or a salon subscribes
  profile_id uuid references profiles(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  tier subscription_tier not null default 'trial',
  status subscription_status not null default 'active',
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '14 days'),
  liqpay_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sub_owner_check check (
    (profile_id is not null and salon_id is null) or
    (profile_id is null and salon_id is not null)
  )
);

-- ============================================================
-- MASTERS
-- ============================================================

create table masters (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  salon_id uuid references salons(id) on delete set null,
  specialization text,
  bio text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  rating numeric(3,2) default 0,
  total_reviews int default 0,
  working_hours jsonb not null default '{}',
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SERVICE CATEGORIES
-- ============================================================

create table service_categories (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid references masters(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SERVICES
-- ============================================================

create table services (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid references masters(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  description text,
  duration_minutes int not null default 60,
  price numeric(10,2) not null default 0,
  currency text not null default 'UAH',
  color text default '#6366f1',
  is_active boolean not null default true,
  -- upsell: services to suggest when this one is booked
  upsell_services uuid[] default '{}',
  -- inventory: auto-deduction recipe
  inventory_recipe jsonb default '[]',
  requires_prepayment boolean default false,
  prepayment_amount numeric(10,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CLIENTS (per master/salon — NOT global users)
-- ============================================================

create table clients (
  id uuid primary key default uuid_generate_v4(),
  -- the actual user profile (nullable — master can add clients manually)
  profile_id uuid references profiles(id) on delete set null,
  master_id uuid references masters(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  date_of_birth date,
  notes text,
  -- allergy/contraindication data
  allergies text[] default '{}',
  contraindications text[] default '{}',
  has_health_alert boolean default false,
  -- stats (denormalized for performance)
  total_visits int default 0,
  total_spent numeric(10,2) default 0,
  avg_check numeric(10,2) default 0,
  last_visit_at timestamptz,
  -- rating & behavior
  rating numeric(3,2) default 5.0,
  behavior_indicators behavior_indicator[] default '{}',
  cancellation_count int default 0,
  no_show_count int default 0,
  -- family linking
  family_group_id uuid,
  -- referral
  referred_by uuid references clients(id) on delete set null,
  referral_code text unique default encode(gen_random_bytes(6), 'hex'),
  referral_bonus_points int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

create table appointments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  master_id uuid not null references masters(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  salon_id uuid references salons(id) on delete set null,
  -- equipment reservation (optional, for shared resources)
  equipment_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'booked',
  price numeric(10,2) not null default 0,
  currency text not null default 'UAH',
  notes text,
  -- consent tracking
  consent_given boolean default false,
  consent_given_at timestamptz,
  -- source tracking
  booked_via text default 'web', -- 'web', 'telegram', 'manual'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EQUIPMENT (shared resources like lasers, chairs)
-- ============================================================

create table equipment (
  id uuid primary key default uuid_generate_v4(),
  salon_id uuid references salons(id) on delete cascade,
  master_id uuid references masters(id) on delete cascade,
  name text not null,
  description text,
  -- resource tracking (e.g., laser pulses, lamp hours)
  total_resource numeric(10,2),
  used_resource numeric(10,2) default 0,
  resource_unit text, -- 'pulses', 'hours', etc.
  maintenance_threshold numeric(10,2),
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- Add FK for equipment_id on appointments
alter table appointments
  add constraint fk_appointment_equipment
  foreign key (equipment_id) references equipment(id) on delete set null;

-- ============================================================
-- INVENTORY
-- ============================================================

create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid references masters(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  name text not null,
  description text,
  quantity numeric(10,3) not null default 0,
  unit text not null default 'pcs', -- pcs, ml, g, etc.
  cost_per_unit numeric(10,2) default 0,
  currency text not null default 'UAH',
  low_stock_threshold numeric(10,3) default 5,
  barcode text,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory_usage (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  quantity_used numeric(10,3) not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references profiles(id) on delete set null
);

-- ============================================================
-- PAYMENTS
-- ============================================================

create table payments (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid references appointments(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  master_id uuid references masters(id) on delete set null,
  salon_id uuid references salons(id) on delete set null,
  amount numeric(10,2) not null,
  currency text not null default 'UAH',
  type payment_type not null,
  status payment_status not null default 'pending',
  liqpay_order_id text,
  liqpay_payment_id text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- REVIEWS (anonymous, bidirectional)
-- ============================================================

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid references appointments(id) on delete set null,
  -- who is being reviewed
  target_type text not null check (target_type in ('master', 'client')),
  target_master_id uuid references masters(id) on delete cascade,
  target_client_id uuid references clients(id) on delete cascade,
  -- reviewer (anonymous — only stored for dedup)
  reviewer_profile_id uuid references profiles(id) on delete set null,
  score int not null check (score between 1 and 5),
  comment text,
  is_published boolean default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REFERRALS
-- ============================================================

create table referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_client_id uuid not null references clients(id) on delete cascade,
  referred_client_id uuid not null references clients(id) on delete cascade,
  bonus_points int default 0,
  bonus_redeemed boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONSENT FORMS
-- ============================================================

create table consent_forms (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  master_id uuid not null references masters(id) on delete cascade,
  form_text text not null,
  client_agreed boolean not null default false,
  agreed_at timestamptz,
  client_ip text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CLIENT FILES (photos, PDFs — Business tier only)
-- ============================================================

create table client_files (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text, -- 'image/jpeg', 'application/pdf', etc.
  file_size_bytes int,
  description text,
  -- before/after pairing
  is_before_photo boolean default false,
  paired_with uuid references client_files(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WAITLIST
-- ============================================================

create table waitlist (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  master_id uuid not null references masters(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  desired_date date not null,
  desired_time_start time,
  desired_time_end time,
  notified boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- GIFT CERTIFICATES
-- ============================================================

create table gift_certificates (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid references masters(id) on delete cascade,
  salon_id uuid references salons(id) on delete cascade,
  purchased_by uuid references profiles(id) on delete set null,
  redeemed_by uuid references clients(id) on delete set null,
  code text unique not null default encode(gen_random_bytes(8), 'hex'),
  amount numeric(10,2) not null,
  currency text not null default 'UAH',
  is_redeemed boolean default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- GUILDS (cross-marketing master groups)
-- ============================================================

create table guilds (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid not null references masters(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table guild_members (
  guild_id uuid not null references guilds(id) on delete cascade,
  master_id uuid not null references masters(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (guild_id, master_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  channel notification_channel not null default 'telegram',
  title text not null,
  body text not null,
  data jsonb default '{}',
  status notification_status not null default 'pending',
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- MASTER-CLIENT LINK (which masters a client follows)
-- ============================================================

create table client_master_links (
  profile_id uuid not null references profiles(id) on delete cascade,
  master_id uuid not null references masters(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (profile_id, master_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_profiles_telegram on profiles(telegram_id);
create index idx_masters_profile on masters(profile_id);
create index idx_masters_salon on masters(salon_id);
create index idx_masters_location on masters(latitude, longitude) where latitude is not null;
create index idx_masters_invite_code on masters(invite_code);
create index idx_clients_master on clients(master_id);
create index idx_clients_salon on clients(salon_id);
create index idx_clients_profile on clients(profile_id);
create index idx_clients_referral_code on clients(referral_code);
create index idx_appointments_master_date on appointments(master_id, starts_at);
create index idx_appointments_client on appointments(client_id);
create index idx_appointments_status on appointments(status);
create index idx_appointments_equipment on appointments(equipment_id, starts_at) where equipment_id is not null;
create index idx_inventory_master on inventory_items(master_id);
create index idx_inventory_salon on inventory_items(salon_id);
create index idx_notifications_profile_status on notifications(profile_id, status);
create index idx_notifications_scheduled on notifications(scheduled_for) where status = 'pending';
create index idx_waitlist_master_date on waitlist(master_id, desired_date);
create index idx_services_master on services(master_id);
create index idx_services_salon on services(salon_id);
create index idx_payments_appointment on payments(appointment_id);
create index idx_client_master_links_master on client_master_links(master_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where column_name = 'updated_at'
      and table_schema = 'public'
  loop
    execute format(
      'create trigger trg_updated_at before update on %I for each row execute function update_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (basic policies)
-- ============================================================

alter table profiles enable row level security;
alter table salons enable row level security;
alter table masters enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table services enable row level security;
alter table inventory_items enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table client_files enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Masters: public read for active masters, owner can update
create policy "Anyone can view active masters" on masters
  for select using (is_active = true);
create policy "Master owner can update" on masters
  for update using (auth.uid() = profile_id);

-- Services: public read for active services
create policy "Anyone can view active services" on services
  for select using (is_active = true);
create policy "Master can manage own services" on services
  for all using (master_id in (select id from masters where profile_id = auth.uid()));

-- Clients: master/salon can see their own clients
create policy "Master sees own clients" on clients
  for select using (
    master_id in (select id from masters where profile_id = auth.uid())
    or salon_id in (select id from salons where owner_id = auth.uid())
  );
create policy "Master can manage own clients" on clients
  for all using (
    master_id in (select id from masters where profile_id = auth.uid())
    or salon_id in (select id from salons where owner_id = auth.uid())
  );

-- Appointments: involved parties can see
create policy "Appointment visible to participants" on appointments
  for select using (
    master_id in (select id from masters where profile_id = auth.uid())
    or client_id in (select id from clients where profile_id = auth.uid())
  );

-- Notifications: own only
create policy "Own notifications" on notifications
  for select using (profile_id = auth.uid());

-- Client files: master who owns the client can access
create policy "Master can access client files" on client_files
  for all using (
    client_id in (
      select id from clients
      where master_id in (select id from masters where profile_id = auth.uid())
    )
  );
