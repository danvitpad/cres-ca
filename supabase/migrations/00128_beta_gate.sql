-- --- YAML
-- name: 00128_beta_gate
-- description: Phase 11 / Шаг 1 — бета-гейт перед релизом.
--   1) Таблица beta_invites — пул разрешённых для регистрации (email + опц. tg_id) со статусом.
--   2) Таблица app_settings — глобальные ключ-значение настройки. Сейчас один ключ:
--      public_signup_open (bool, default false). Когда сервис релизнем — Данил
--      жмёт кнопку «Опубликовать» и флаг становится true → регистрация для всех.
--   3) RPC is_signup_allowed(p_email, p_telegram_id) — единая точка проверки
--      для обоих signup endpoint'ов (web + Mini App).
--   4) Триггер: когда заявка переводится в approved, автоматически создаётся
--      запись в platform_whitelist (granted_plan='business', expires_at=+6 месяцев)
--      когда у пользователя появится профиль (если профиль ещё не создан — функция
--      grant_beta_whitelist отрабатывает в момент регистрации).
-- created: 2026-04-29
-- ---

-- ────────────────────────────────────────────────────────────────────────
-- 1. beta_invites — список одобренных для регистрации в бета-период.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  email text,
  telegram_id bigint,
  full_name text,
  source text not null default 'manual'
    check (source in ('manual', 'bot_request', 'self_signup', 'imported')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'used')),

  -- Решение
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,

  -- После регистрации связываем с профилем
  used_at timestamptz,
  used_by_profile_id uuid references public.profiles(id) on delete set null,

  -- Доп информация которую могут заполнить при заявке
  note text,
  request_text text,                  -- Что писал пользователь боту
  ip_address inet,                    -- Откуда пришла заявка (для антифрода)

  created_at timestamptz not null default now(),

  -- Хотя бы один из идентификаторов должен быть указан
  constraint beta_invites_id_present check (email is not null or telegram_id is not null)
);

-- Уникальность: одна заявка на email и одна на telegram_id (в активных статусах)
create unique index if not exists idx_beta_invites_unique_email
  on public.beta_invites(lower(email))
  where email is not null and status in ('pending', 'approved');

create unique index if not exists idx_beta_invites_unique_tg
  on public.beta_invites(telegram_id)
  where telegram_id is not null and status in ('pending', 'approved');

create index if not exists idx_beta_invites_status
  on public.beta_invites(status, created_at desc);

create index if not exists idx_beta_invites_approved
  on public.beta_invites(status)
  where status = 'approved' and used_at is null;

alter table public.beta_invites enable row level security;

-- Никто из обычных юзеров не читает напрямую (только через server-role и RPC)
drop policy if exists "beta_invites_no_public" on public.beta_invites;
create policy "beta_invites_no_public" on public.beta_invites
  for select using (false);

comment on table public.beta_invites is
  'Pre-signup pool: emails / telegram_ids allowed to register during beta period. Когда public_signup_open=true — игнорируется (любой может регистрироваться).';

-- ────────────────────────────────────────────────────────────────────────
-- 2. app_settings — глобальные ключ-значение настройки.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Стартовый набор настроек
insert into public.app_settings (key, value, description)
values
  ('public_signup_open',
   'false'::jsonb,
   'Когда true — регистрация открыта всем без проверки бета-списка. По умолчанию false до релиза.'),
  ('beta_grant_plan',
   '"business"'::jsonb,
   'Какой тариф выдавать одобренным бета-тестировщикам.'),
  ('beta_grant_months',
   '6'::jsonb,
   'На сколько месяцев выдавать бесплатный полный доступ одобренным.')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_no_public" on public.app_settings;
create policy "app_settings_no_public" on public.app_settings
  for select using (false);

comment on table public.app_settings is
  'Глобальные настройки сервиса. Читаются только через server-role и через RPC is_signup_allowed.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. RPC: is_signup_allowed — проверка перед регистрацией.
-- ────────────────────────────────────────────────────────────────────────
-- Используется обоими signup endpoint'ами. Возвращает:
--   { allowed: boolean, reason: 'open'|'whitelisted'|'closed_no_match' }

create or replace function public.is_signup_allowed(
  p_email text default null,
  p_telegram_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
  v_invite_id uuid;
begin
  -- 1. Если регистрация открыта всем — пропускаем
  select (value::text)::boolean into v_open
  from public.app_settings where key = 'public_signup_open';

  if coalesce(v_open, false) then
    return jsonb_build_object('allowed', true, 'reason', 'open');
  end if;

  -- 2. Иначе ищем в бета-списке (используем FOUND вместо record IS NULL)
  if p_email is not null then
    select id into v_invite_id
    from public.beta_invites
    where lower(email) = lower(p_email)
      and status = 'approved'
      and used_at is null
    limit 1;
    if found then
      return jsonb_build_object('allowed', true, 'reason', 'whitelisted', 'invite_id', v_invite_id);
    end if;
  end if;

  if p_telegram_id is not null then
    select id into v_invite_id
    from public.beta_invites
    where telegram_id = p_telegram_id
      and status = 'approved'
      and used_at is null
    limit 1;
    if found then
      return jsonb_build_object('allowed', true, 'reason', 'whitelisted', 'invite_id', v_invite_id);
    end if;
  end if;

  -- 3. Закрыто и не нашли — отказ
  return jsonb_build_object('allowed', false, 'reason', 'closed_no_match');
end;
$$;

grant execute on function public.is_signup_allowed(text, bigint) to anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 4. RPC: consume_beta_invite — пометить заявку как использованную после signup.
-- ────────────────────────────────────────────────────────────────────────
-- Вызывается после успешного создания профиля. Помечает used_at + used_by_profile_id
-- + автоматически создаёт platform_whitelist row на 6 месяцев (granted_plan='business').

create or replace function public.consume_beta_invite(
  p_profile_id uuid,
  p_email text default null,
  p_telegram_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_approver uuid;
  v_plan text;
  v_months int;
begin
  -- Найти подходящую заявку
  select id, approved_by into v_invite_id, v_approver
  from public.beta_invites
  where status = 'approved'
    and used_at is null
    and (
      (p_email is not null and lower(email) = lower(p_email))
      or (p_telegram_id is not null and telegram_id = p_telegram_id)
    )
  order by approved_at desc
  limit 1;

  if not found then
    return;  -- Не было заявки — это значит регистрация прошла из-за public_signup_open=true
  end if;

  -- Помечаем использованной
  update public.beta_invites
  set status = 'used',
      used_at = now(),
      used_by_profile_id = p_profile_id
  where id = v_invite_id;

  -- Выдаём whitelist на N месяцев
  select (value::text)::int into v_months from public.app_settings where key = 'beta_grant_months';
  select trim(both '"' from value::text) into v_plan from public.app_settings where key = 'beta_grant_plan';

  insert into public.platform_whitelist (profile_id, granted_plan, reason, expires_at, granted_by)
  values (
    p_profile_id,
    coalesce(v_plan, 'business'),
    'beta_tester_grant',
    now() + (coalesce(v_months, 6) || ' months')::interval,
    v_approver
  )
  on conflict (profile_id) do update
  set granted_plan = excluded.granted_plan,
      reason = excluded.reason,
      expires_at = excluded.expires_at;
end;
$$;

grant execute on function public.consume_beta_invite(uuid, text, bigint) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 5. Helper RPC для бота — создать заявку из Telegram
-- ────────────────────────────────────────────────────────────────────────

create or replace function public.create_beta_request(
  p_telegram_id bigint,
  p_email text default null,
  p_full_name text default null,
  p_request_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing_id uuid;
begin
  -- Если уже есть активная заявка для этого tg_id — вернуть её id
  select id into v_existing_id
  from public.beta_invites
  where telegram_id = p_telegram_id
    and status in ('pending', 'approved')
  limit 1;

  if found then
    -- Обновить email/имя если пришли новые
    update public.beta_invites
    set email = coalesce(p_email, email),
        full_name = coalesce(p_full_name, full_name),
        request_text = coalesce(p_request_text, request_text)
    where id = v_existing_id;
    return v_existing_id;
  end if;

  insert into public.beta_invites (telegram_id, email, full_name, source, request_text)
  values (p_telegram_id, p_email, p_full_name, 'bot_request', p_request_text)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_beta_request(bigint, text, text, text) to service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 6. Helper view для суперадмин-страницы /superadmin/beta
-- ────────────────────────────────────────────────────────────────────────

create or replace view public.beta_invites_admin as
select
  b.id,
  b.email,
  b.telegram_id,
  b.full_name,
  b.source,
  b.status,
  b.note,
  b.request_text,
  b.created_at,
  b.approved_at,
  b.rejected_at,
  b.used_at,
  b.used_by_profile_id,
  -- Связанный профиль (если уже зарегистрирован)
  p.email as profile_email,
  p.full_name as profile_full_name,
  p.role as profile_role,
  -- Кто одобрил
  approver.email as approved_by_email
from public.beta_invites b
left join public.profiles p on p.id = b.used_by_profile_id
left join public.profiles approver on approver.id = b.approved_by;

comment on view public.beta_invites_admin is
  'Удобный view для админ-страницы: заявки + связанные профили + email одобрившего.';
