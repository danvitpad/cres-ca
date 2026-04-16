-- Reminders: voice-first task system for masters
-- Source: Telegram voice → Gemini 2.5 Flash → structured reminder

create table if not exists reminders (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid not null references masters(id) on delete cascade,
  text text not null,
  due_at timestamptz,                          -- null = no specific time, just a note
  completed boolean not null default false,
  completed_at timestamptz,
  source text not null default 'manual',       -- 'voice', 'manual', 'system'
  original_audio_url text,                     -- telegram file link for voice reminders
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reminders_master_due on reminders(master_id, due_at)
  where completed = false;

create index idx_reminders_master_active on reminders(master_id, created_at desc)
  where completed = false;

-- RLS
alter table reminders enable row level security;

create policy "Masters see own reminders"
  on reminders for select
  using (master_id in (select id from masters where profile_id = auth.uid()));

create policy "Masters insert own reminders"
  on reminders for insert
  with check (master_id in (select id from masters where profile_id = auth.uid()));

create policy "Masters update own reminders"
  on reminders for update
  using (master_id in (select id from masters where profile_id = auth.uid()));

create policy "Masters delete own reminders"
  on reminders for delete
  using (master_id in (select id from masters where profile_id = auth.uid()));

-- Service role bypass for webhook/cron
create policy "Service role full access"
  on reminders for all
  using (auth.role() = 'service_role');
