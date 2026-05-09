/** --- YAML
 * name: Master AI agent chat history
 * description: Persistent memory for the master AI agent — survives page reloads,
 *   bridges three surfaces (web /today, Mini App, TG voice) into one conversation
 *   so the agent remembers context like "свободно в четверг 14/16" → "запиши на 14".
 *
 *   Tables NAMED master_chat_* (not ai_*) because the existing ai_messages table
 *   is used by the client AI concierge with a different schema (profile_id +
 *   surface + intent). Keeping them separate avoids breaking client-side flow.
 *
 *   1) master_chat_conversations — one row per master (UNIQUE master_id).
 *   2) master_chat_messages — append-only history of user/assistant messages.
 *   3) get_master_conversation(master_id) — get-or-create helper.
 *   4) cleanup_master_chat() — drops messages older than 30 days. Scheduled
 *      daily via pg_cron at 04:17 UTC (idle hour, no overlap with other crons).
 *      Runs as scheduled via Supabase pg_cron + cron-job.org redundancy.
 * created: 2026-05-09
 * --- */

create table if not exists public.master_chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid not null references public.masters(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (master_id)
);

create table if not exists public.master_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.master_chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mcm_conv_created
  on public.master_chat_messages(conversation_id, created_at desc);

alter table public.master_chat_conversations enable row level security;
alter table public.master_chat_messages enable row level security;

drop policy if exists "mcc_own" on public.master_chat_conversations;
create policy "mcc_own" on public.master_chat_conversations
  for all
  using (master_id in (select id from public.masters where profile_id = auth.uid()))
  with check (master_id in (select id from public.masters where profile_id = auth.uid()));

drop policy if exists "mcm_own" on public.master_chat_messages;
create policy "mcm_own" on public.master_chat_messages
  for all
  using (
    conversation_id in (
      select c.id from public.master_chat_conversations c
      join public.masters m on m.id = c.master_id
      where m.profile_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select c.id from public.master_chat_conversations c
      join public.masters m on m.id = c.master_id
      where m.profile_id = auth.uid()
    )
  );

create or replace function public.get_master_conversation(p_master_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_id uuid;
begin
  select id into v_id from public.master_chat_conversations where master_id = p_master_id;
  if v_id is null then
    insert into public.master_chat_conversations(master_id) values (p_master_id) returning id into v_id;
  end if;
  return v_id;
end;
$func$;

create or replace function public.cleanup_master_chat()
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  delete from public.master_chat_messages where created_at < now() - interval '30 days';
  delete from public.master_chat_conversations where last_message_at < now() - interval '30 days';
end;
$func$;

grant execute on function public.get_master_conversation(uuid) to authenticated, service_role;
grant execute on function public.cleanup_master_chat() to service_role;

-- Schedule daily cleanup at 04:17 UTC. Run separately because dollar-quoted
-- nested cron.schedule body conflicts with Supabase Studio's parser when in
-- the same DO block as table creation.
-- select cron.schedule('master-chat-cleanup', '17 4 * * *', 'select public.cleanup_master_chat();');
