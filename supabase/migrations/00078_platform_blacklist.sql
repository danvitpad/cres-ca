-- --- YAML
-- name: 00078_platform_blacklist
-- description: platform_blacklist table — superadmin-managed ban list. Banned users get signed out on next request.
-- created: 2026-04-21
-- ---

create table if not exists public.platform_blacklist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  banned_by uuid references public.profiles(id) on delete set null,
  banned_at timestamptz not null default now(),
  unique(profile_id)
);

create index if not exists idx_platform_blacklist_profile on public.platform_blacklist(profile_id);

alter table public.platform_blacklist enable row level security;

-- Only superadmins can read/write. Ordinary users must not know whether they are banned via this table
-- (they learn by being forcibly signed out and routed to /banned).
drop policy if exists "superadmin blacklist read" on public.platform_blacklist;
create policy "superadmin blacklist read"
  on public.platform_blacklist for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.email in (
          'daniilpadalko97@gmail.com'
        )
    )
  );

drop policy if exists "superadmin blacklist write" on public.platform_blacklist;
create policy "superadmin blacklist write"
  on public.platform_blacklist for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.email in (
          'daniilpadalko97@gmail.com'
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.email in (
          'daniilpadalko97@gmail.com'
        )
    )
  );

-- Helper function: checks if a profile is currently banned. Used by middleware.
-- SECURITY DEFINER because platform_blacklist RLS blocks non-superadmin reads.
create or replace function public.is_profile_banned(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_blacklist where profile_id = p_profile_id
  );
$$;

grant execute on function public.is_profile_banned(uuid) to anon, authenticated, service_role;

-- Helper: returns current user's ban reason (or null). Used by /banned page.
-- Uses auth.uid() so users can only read their own reason.
create or replace function public.get_my_ban_reason()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select reason from public.platform_blacklist where profile_id = auth.uid();
$$;

grant execute on function public.get_my_ban_reason() to authenticated, service_role;

comment on table public.platform_blacklist is 'Banned profiles. Superadmin-only. Banned users are signed out on next request and shown /banned.';
