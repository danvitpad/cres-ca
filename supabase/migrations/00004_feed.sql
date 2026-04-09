-- Feed posts for client-facing social feed
create table feed_posts (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references masters(id) on delete cascade,
  type text not null check (type in ('new_service', 'promotion', 'before_after', 'burning_slot', 'update')),
  title text,
  body text,
  image_url text,
  linked_service_id uuid references services(id),
  linked_product_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_feed_posts_master on feed_posts(master_id);
create index idx_feed_posts_created on feed_posts(created_at desc);

-- RLS
alter table feed_posts enable row level security;

-- Anyone authenticated can read feed posts from masters they follow
create policy "Users can read feed posts from followed masters"
  on feed_posts for select
  using (
    exists (
      select 1 from client_master_links cml
      where cml.master_id = feed_posts.master_id
        and cml.profile_id = auth.uid()
    )
  );

-- Masters can manage their own feed posts
create policy "Masters can insert own feed posts"
  on feed_posts for insert
  with check (
    master_id in (select id from masters where profile_id = auth.uid())
  );

create policy "Masters can update own feed posts"
  on feed_posts for update
  using (
    master_id in (select id from masters where profile_id = auth.uid())
  );

create policy "Masters can delete own feed posts"
  on feed_posts for delete
  using (
    master_id in (select id from masters where profile_id = auth.uid())
  );
