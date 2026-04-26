-- 00114: метрики для публичной страницы мастера в Fresha-стиле + языки + место работы.
--
-- 1. completed_appointments_count — кэш числа выполненных визитов
-- 2. served_clients_count — кэш уникальных клиентов
-- 3. languages text[] — на каких языках общается мастер с клиентами
-- 4. workplace_photo_url — фото кабинета/мастерской (для соло-мастеров без салона)
-- 5. workplace_name — название места работы для соло-мастеров (если не привязан к salons)
--
-- Триггер на appointments перешитывает оба counter'а при INSERT/UPDATE/DELETE.
-- Backfill в этой же миграции пересчитывает текущие значения для всех мастеров.

ALTER TABLE public.masters
  ADD COLUMN IF NOT EXISTS completed_appointments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS served_clients_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS workplace_photo_url text,
  ADD COLUMN IF NOT EXISTS workplace_name text;

CREATE INDEX IF NOT EXISTS masters_public_metrics_idx
  ON public.masters (completed_appointments_count DESC, served_clients_count DESC);

CREATE OR REPLACE FUNCTION recompute_master_public_metrics(p_master_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE masters m
  SET
    completed_appointments_count = COALESCE((
      SELECT COUNT(*)::int FROM appointments
      WHERE master_id = p_master_id AND status = 'completed'
    ), 0),
    served_clients_count = COALESCE((
      SELECT COUNT(DISTINCT client_id)::int FROM appointments
      WHERE master_id = p_master_id AND status = 'completed' AND client_id IS NOT NULL
    ), 0)
  WHERE m.id = p_master_id;
END;
$$;

CREATE OR REPLACE FUNCTION sync_master_public_metrics()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  affected uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      PERFORM recompute_master_public_metrics(NEW.master_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.master_id IS DISTINCT FROM NEW.master_id) THEN
      affected := ARRAY[NEW.master_id];
      IF OLD.master_id IS NOT NULL AND OLD.master_id <> NEW.master_id THEN
        affected := array_append(affected, OLD.master_id);
      END IF;
      FOR i IN 1..array_length(affected, 1) LOOP
        PERFORM recompute_master_public_metrics(affected[i]);
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' THEN
      PERFORM recompute_master_public_metrics(OLD.master_id);
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS appointments_sync_master_metrics ON appointments;
CREATE TRIGGER appointments_sync_master_metrics
AFTER INSERT OR UPDATE OF status, master_id, client_id OR DELETE ON appointments
FOR EACH ROW EXECUTE FUNCTION sync_master_public_metrics();

DO $$
DECLARE m RECORD;
BEGIN
  FOR m IN SELECT id FROM masters LOOP
    PERFORM recompute_master_public_metrics(m.id);
  END LOOP;
END $$;
