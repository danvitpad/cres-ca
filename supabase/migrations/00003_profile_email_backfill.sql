-- Copy email into profiles on user creation + backfill existing rows

alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_email_unique on public.profiles (lower(email)) where email is not null;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, phone, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.email
  );

  if (new.raw_user_meta_data->>'role') = 'master' then
    insert into public.masters (profile_id) values (new.id);
  end if;

  if (new.raw_user_meta_data->>'role') = 'salon_admin' then
    declare
      new_salon_id uuid;
    begin
      insert into public.salons (owner_id, name)
      values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'My Salon'))
      returning id into new_salon_id;

      insert into public.masters (profile_id, salon_id)
      values (new.id, new_salon_id);
    end;
  end if;

  insert into public.subscriptions (profile_id, tier, status, trial_ends_at, current_period_end)
  values (new.id, 'trial', 'active', now() + interval '14 days', now() + interval '14 days');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill email for existing profiles
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');
</content>
</invoke>
