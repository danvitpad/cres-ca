-- Web push subscription
alter table profiles add column if not exists push_subscription jsonb;

-- Auto-translation cache
create table translations_cache (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  source_field text not null,
  target_locale text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  unique(source_table, source_id, source_field, target_locale)
);

-- Multi-location for masters
create table master_locations (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references masters(id) on delete cascade,
  name text not null,
  address text not null,
  city text,
  latitude double precision,
  longitude double precision,
  working_hours jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table translations_cache enable row level security;
alter table master_locations enable row level security;

create policy "Anyone can read translations"
  on translations_cache for select
  using (true);

create policy "Masters manage own locations"
  on master_locations for all
  using (master_id in (select id from masters where profile_id = auth.uid()));
