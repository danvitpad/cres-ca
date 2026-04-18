-- --- YAML
-- name: AI Daily Briefs Cache
-- description: Per-master per-day cache for AI-generated daily briefs shown on Mini App home.
--              One brief per master per local day; regenerated on first view of new day.
-- created: 2026-04-19

create table if not exists public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  brief_date date not null,
  brief_text text not null,
  model text,
  created_at timestamptz not null default now(),
  unique (master_id, brief_date)
);

create index if not exists idx_ai_briefs_master_date on public.ai_briefs (master_id, brief_date desc);

alter table public.ai_briefs enable row level security;

-- No public client access — service_role only (API reads/writes via admin client).
-- Intentionally no policies for anon/authenticated.
