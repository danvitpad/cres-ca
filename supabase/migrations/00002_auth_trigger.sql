-- Auto-create profile, master record, and trial subscription when a user signs up

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );

  -- If role is master, also create a master record
  if (new.raw_user_meta_data->>'role') = 'master' then
    insert into public.masters (profile_id)
    values (new.id);
  end if;

  -- If role is salon_admin, create salon + master record
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

  -- Create trial subscription
  insert into public.subscriptions (profile_id, tier, status, trial_ends_at, current_period_end)
  values (new.id, 'trial', 'active', now() + interval '14 days', now() + interval '14 days');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Drop existing trigger if any, then create
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
