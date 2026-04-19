-- --- YAML
-- name: User feedback table
-- description: Mega-plan Phase 12. Feedback from any user (text or voice).
--              Sent to TG channel FEEDBACK_TG_CHANNEL_ID as original + cleaned version.
-- created: 2026-04-19

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('web_settings', 'telegram_bot', 'telegram_voice', 'mobile')),
  original_text text not null,
  cleaned_text text,
  voice_file_url text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'actioned', 'closed')),
  tg_message_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_profile on public.feedback(profile_id, created_at desc);
create index if not exists idx_feedback_status on public.feedback(status) where status = 'new';

alter table public.feedback enable row level security;

drop policy if exists "own feedback read" on public.feedback;
create policy "own feedback read"
  on public.feedback for select
  using (profile_id = auth.uid());

drop policy if exists "own feedback insert" on public.feedback;
create policy "own feedback insert"
  on public.feedback for insert
  with check (profile_id = auth.uid());
