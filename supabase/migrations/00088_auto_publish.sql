/** --- YAML
 * name: 00088_auto_publish
 * description: Убирает ручное opt-in для публикации мастера. Публикация автоматическая:
 *              активная подписка = публикуется. Slug генерится триггером при создании.
 *              is_public теперь "личный override" — можно скрыть вручную, но по дефолту TRUE.
 * created: 2026-04-24
 * --- */

-- 1. Default TRUE для is_public. Для старых записей — проставить TRUE если есть активная подписка.
alter table public.masters alter column is_public set default true;

update public.masters m
set is_public = true
where m.is_public = false
  and exists (
    select 1 from public.subscriptions s
    where s.profile_id = m.profile_id
      and s.status = 'active'
  );

-- 2. Трigger: автогенерация slug при INSERT мастера (и при UPDATE если slug пустой)
create or replace function public.auto_generate_master_slug()
returns trigger
language plpgsql
as $$
declare
  v_name text;
  v_spec text;
  v_city text;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  -- Берём имя из связанного profile
  select coalesce(p.full_name, p.first_name, 'master'), new.specialization, new.city
  into v_name, v_spec, v_city
  from public.profiles p where p.id = new.profile_id;

  new.slug := public.generate_master_slug(v_name, coalesce(v_spec, ''), coalesce(v_city, ''));
  return new;
end;
$$;

drop trigger if exists trg_auto_slug_insert on public.masters;
create trigger trg_auto_slug_insert
  before insert on public.masters
  for each row execute function public.auto_generate_master_slug();

drop trigger if exists trg_auto_slug_update on public.masters;
create trigger trg_auto_slug_update
  before update of specialization, city on public.masters
  for each row
  when (new.slug is null or new.slug = '')
  execute function public.auto_generate_master_slug();

-- 3. Backfill: проставить slug всем кто без него
update public.masters m
set slug = public.generate_master_slug(
  coalesce((select full_name from public.profiles where id = m.profile_id), 'master'),
  coalesce(m.specialization, ''),
  coalesce(m.city, '')
)
where m.slug is null or m.slug = '';

-- 4. Effective visibility function: мастер виден если
--    (а) is_public = true И активная подписка (или trial)
--    ИЛИ (б) is_public = true И подписок вообще нет (редкий случай, пока в trial не создан)
create or replace function public.is_master_indexable(p_master_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.masters m
    left join public.subscriptions s on s.profile_id = m.profile_id
    where m.id = p_master_id
      and m.is_public = true
      and m.is_active = true
      and (s.status is null or s.status = 'active')
  );
$$;

grant execute on function public.is_master_indexable(uuid) to anon, authenticated, service_role;

-- 5. Обновляем RLS — теперь публичный доступ завязан на is_master_indexable()
drop policy if exists "masters_public_read" on public.masters;
create policy "masters_public_read" on public.masters
  for select using (
    is_public = true
    and is_active = true
    and exists (
      select 1 from public.subscriptions s
      where s.profile_id = masters.profile_id
        and s.status = 'active'
    )
  );

drop policy if exists "services_public_read" on public.services;
create policy "services_public_read" on public.services
  for select using (
    is_active = true
    and master_id in (
      select m.id from public.masters m
      join public.subscriptions s on s.profile_id = m.profile_id
      where m.is_public = true
        and m.is_active = true
        and s.status = 'active'
    )
  );

drop policy if exists "reviews_public_master_read" on public.reviews;
create policy "reviews_public_master_read" on public.reviews
  for select using (
    is_published = true
    and target_type = 'master'
    and target_id in (
      select m.id from public.masters m
      join public.subscriptions s on s.profile_id = m.profile_id
      where m.is_public = true
        and m.is_active = true
        and s.status = 'active'
    )
  );

-- 6. View master_ratings — также через активную подписку
create or replace view public.master_ratings as
select
  m.id as master_id,
  count(r.id)::int as reviews_count,
  round(avg(r.score)::numeric, 2) as average_score
from public.masters m
join public.subscriptions s on s.profile_id = m.profile_id
left join public.reviews r
  on r.target_type = 'master'
  and r.target_id = m.id
  and r.is_published = true
where m.is_public = true
  and m.is_active = true
  and s.status = 'active'
group by m.id;

grant select on public.master_ratings to anon, authenticated;

comment on function public.is_master_indexable is
  'Master is publicly indexable iff: is_public=true AND is_active=true AND subscription status = active (covers paying + trial users — trial rows have tier=trial, status=active).';
