-- 00108: счётчик использований услуги для блока «Частые услуги» в drawer'е новой записи.
--
-- Триггер на appointments: ++ при появлении completed-визита, -- если completed
-- откатывается обратно. Backfill при добавлении считает уже накопленную историю.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS total_uses integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS services_total_uses_idx
  ON public.services (master_id, total_uses DESC);

CREATE OR REPLACE FUNCTION sync_service_total_uses()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- INSERT: появляется сразу как completed
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' AND NEW.service_id IS NOT NULL THEN
    UPDATE services SET total_uses = total_uses + 1 WHERE id = NEW.service_id;
    RETURN NEW;
  END IF;

  -- UPDATE: переход в completed / выход из completed / смена service_id у completed
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status = 'completed') IS DISTINCT FROM (NEW.status = 'completed') THEN
      IF NEW.status = 'completed' AND NEW.service_id IS NOT NULL THEN
        UPDATE services SET total_uses = total_uses + 1 WHERE id = NEW.service_id;
      ELSIF OLD.status = 'completed' AND OLD.service_id IS NOT NULL THEN
        UPDATE services SET total_uses = GREATEST(0, total_uses - 1) WHERE id = OLD.service_id;
      END IF;
    ELSIF NEW.status = 'completed' AND NEW.service_id IS DISTINCT FROM OLD.service_id THEN
      IF OLD.service_id IS NOT NULL THEN
        UPDATE services SET total_uses = GREATEST(0, total_uses - 1) WHERE id = OLD.service_id;
      END IF;
      IF NEW.service_id IS NOT NULL THEN
        UPDATE services SET total_uses = total_uses + 1 WHERE id = NEW.service_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE completed appointment ⇒ декремент
  IF TG_OP = 'DELETE' AND OLD.status = 'completed' AND OLD.service_id IS NOT NULL THEN
    UPDATE services SET total_uses = GREATEST(0, total_uses - 1) WHERE id = OLD.service_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS appointments_sync_service_total_uses ON appointments;
CREATE TRIGGER appointments_sync_service_total_uses
AFTER INSERT OR UPDATE OF status, service_id OR DELETE ON appointments
FOR EACH ROW EXECUTE FUNCTION sync_service_total_uses();

-- Backfill — пересчитать total_uses на основе текущих completed-визитов
UPDATE services s
SET total_uses = sub.cnt
FROM (
  SELECT service_id, COUNT(*)::int AS cnt
  FROM appointments
  WHERE status = 'completed' AND service_id IS NOT NULL
  GROUP BY service_id
) sub
WHERE s.id = sub.service_id;
