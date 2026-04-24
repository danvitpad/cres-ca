/** --- YAML
 * name: 00090_notification_preferences
 * description: Клиент (и любой profile) сам определяет сколько и когда получать напоминания о визите.
 *              offsets_minutes — массив "за сколько минут до визита". Например [2880, 120] = 2 дня и 2 часа.
 *              По дефолту — 24h и 2h (1440, 120).
 * created: 2026-04-24
 * --- */

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  -- Каждое число = за сколько минут до события прислать напоминание. Max 10 штук.
  offsets_minutes int[] not null default array[1440, 120],  -- 24ч + 2ч
  -- Глобальный on/off
  enabled boolean not null default true,
  -- Тихие часы — не беспокоить между (например 22-07)
  quiet_hours_start smallint,        -- 0..23
  quiet_hours_end smallint,          -- 0..23
  updated_at timestamptz not null default now(),
  constraint np_offsets_chk check (cardinality(offsets_minutes) <= 10 and cardinality(offsets_minutes) > 0),
  constraint np_quiet_chk check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or (quiet_hours_start between 0 and 23 and quiet_hours_end between 0 and 23)
  )
);

alter table public.notification_preferences enable row level security;

drop policy if exists "np_own_read" on public.notification_preferences;
create policy "np_own_read" on public.notification_preferences
  for select using (profile_id = auth.uid());

drop policy if exists "np_own_write" on public.notification_preferences;
create policy "np_own_write" on public.notification_preferences
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Backfill: создать дефолтные настройки для всех существующих profiles
insert into public.notification_preferences (profile_id)
select id from public.profiles
where not exists (select 1 from public.notification_preferences np where np.profile_id = profiles.id)
on conflict (profile_id) do nothing;

-- Trigger: авто-создавать запись на новый profile
create or replace function public.create_default_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_default_notif_prefs on public.profiles;
create trigger trg_create_default_notif_prefs
  after insert on public.profiles
  for each row execute function public.create_default_notification_prefs();

comment on table public.notification_preferences is
  'Per-profile notification timing preferences. cron/reminders читает offsets_minutes и генерит напоминания для КАЖДОГО указанного offset.';
