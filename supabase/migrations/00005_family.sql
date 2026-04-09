-- Family links for booking on behalf of family members
create table family_links (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid references profiles(id) on delete cascade,
  member_name text not null,
  relationship text not null default 'child',
  linked_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_family_links_parent on family_links(parent_profile_id);

-- RLS
alter table family_links enable row level security;

create policy "Users can manage own family links"
  on family_links for all
  using (parent_profile_id = auth.uid())
  with check (parent_profile_id = auth.uid());
