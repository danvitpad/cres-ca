/** --- YAML
 * name: Fix match_waitlist_on_cancel — видалити неіснуючий enum 'cancelled_by_master'
 * description: Тригер містив 'cancelled_by_master' якого немає в appointment_status enum.
 *              PostgreSQL кидав 22P02 при будь-якому UPDATE на appointments — через це
 *              кронджоб appointment-close ніколи не міг закрити запис (і будь-який
 *              інший UPDATE статусу також падав). Прибираємо неіснуючий enum-рядок.
 * created: 2026-05-13
 * --- */

CREATE OR REPLACE FUNCTION public.match_waitlist_on_cancel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    NEW.status IN ('cancelled', 'cancelled_by_client', 'no_show')
    AND OLD.status NOT IN ('cancelled', 'cancelled_by_client', 'no_show', 'completed')
    AND NEW.starts_at > now()
  ) THEN
    RETURN NEW;
  END IF;
  PERFORM public._waitlist_try_match(NEW.master_id, NEW.service_id, NEW.starts_at, NEW.id);
  RETURN NEW;
END;
$$;
