-- 00107: автосинк профайла клиента в clients-row у каждого мастера, у которого
-- этот человек залинкован. Когда клиент меняет имя / телефон / email / ДР в /profile —
-- мастер видит обновления сразу в /clients и в виджетах /today.
--
-- Аватар НЕ дублируется: clients не имеет avatar_url, фронтенд join'ит profiles.avatar_url
-- по profile_id (single source of truth).

CREATE OR REPLACE FUNCTION sync_clients_from_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE clients
  SET
    full_name      = COALESCE(NEW.full_name,      full_name),
    phone          = COALESCE(NEW.phone,          phone),
    email          = COALESCE(NEW.email,          email),
    date_of_birth  = COALESCE(NEW.date_of_birth,  date_of_birth)
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_to_clients ON profiles;
CREATE TRIGGER profiles_sync_to_clients
AFTER UPDATE OF full_name, phone, email, date_of_birth ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_clients_from_profile();

-- Backfill linked clients с актуальными профайл-данными (Зоя сменила инфо после линка)
UPDATE clients c
SET
  full_name      = COALESCE(p.full_name,      c.full_name),
  phone          = COALESCE(p.phone,          c.phone),
  email          = COALESCE(p.email,          c.email),
  date_of_birth  = COALESCE(p.date_of_birth,  c.date_of_birth)
FROM profiles p
WHERE c.profile_id = p.id;
