-- =============================================================
-- 00160: Blacklist enforcement in booking trigger
-- =============================================================
--
-- Bug: Mini App master has «В чёрный список» feature (00159 commit ba60efe)
-- that sets clients.is_blacklisted=true. But the booking flow nowhere
-- checks this flag — a blacklisted client could still book with the
-- same master via /book, /m/[handle], or /telegram/c/book.
--
-- Fix: BEFORE INSERT trigger on appointments — if the matching
-- clients row has is_blacklisted=true, raise an exception with a
-- user-friendly message.
-- =============================================================

CREATE OR REPLACE FUNCTION public.trg_blacklist_blocks_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blacklisted boolean;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_blacklisted INTO v_blacklisted
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_blacklisted IS TRUE THEN
    -- Use a sql-state code that the app layer can detect (custom error).
    RAISE EXCEPTION 'Booking blocked: client is blacklisted by this master'
      USING ERRCODE = 'P0001', HINT = 'blacklisted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blacklist_blocks_booking ON public.appointments;
CREATE TRIGGER trg_blacklist_blocks_booking
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_blacklist_blocks_booking();
