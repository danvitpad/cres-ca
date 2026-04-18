-- Phase 2: ai_actions_log — universal log of voice + automation + rule-based actions
-- Plan mapping: workspace_id → master_id; user_id → profile_id.
-- Used by: Voice AI commands (source='voice'), auto-material deduction trigger (source='automation'),
-- future rule-based automations (source='rules'), Phase 8 Voice Showcase timeline.

create table if not exists ai_actions_log (
  id uuid primary key default uuid_generate_v4(),
  master_id uuid not null references masters(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  source text not null check (source in ('voice', 'automation', 'rules')),
  action_type text not null, -- e.g. 'appointment_created', 'expense_recorded', 'material_deducted'
  input_text text, -- voice transcript if source='voice'
  result jsonb, -- { entity_type, entity_id, changes }
  related_client_id uuid references clients(id) on delete set null,
  related_appointment_id uuid references appointments(id) on delete set null,
  status text not null default 'success'
    check (status in ('success', 'needs_confirmation', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_actions_master on ai_actions_log(master_id, created_at desc);
create index if not exists idx_ai_actions_client on ai_actions_log(related_client_id);
create index if not exists idx_ai_actions_appointment on ai_actions_log(related_appointment_id);
create index if not exists idx_ai_actions_source on ai_actions_log(source);

alter table ai_actions_log enable row level security;

create policy "Master reads own ai_actions_log"
  on ai_actions_log for select
  using (master_id in (select id from masters where profile_id = auth.uid()));

create policy "Master inserts own ai_actions_log"
  on ai_actions_log for insert
  with check (master_id in (select id from masters where profile_id = auth.uid()));

-- Service-role (Voice AI webhook + automation triggers) inserts bypass RLS via service_role key.
