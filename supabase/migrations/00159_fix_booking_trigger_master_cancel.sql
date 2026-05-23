-- =============================================================
-- 00159: Fix trg_booking_updated to recognize cancelled_by_master
-- =============================================================
--
-- Bug: trg_booking_updated checks status IN ('cancelled',
-- 'cancelled_by_client', 'no_show') for v_now_cancelled, but
-- 'cancelled_by_master' is a valid status used everywhere else in
-- the codebase. Without this, when a master cancels via any path that
-- doesn't manually insert notifications (e.g. AI cron, daily-closeout,
-- future flows), the client is NOT notified.
--
-- Fix: add 'cancelled_by_master' to the list. Same for v_was_active
-- (defensive — master could re-cancel an already-cancelled-by-client).
-- =============================================================

CREATE OR REPLACE FUNCTION public.trg_booking_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_active boolean;
  v_now_cancelled boolean;
BEGIN
  v_was_active := OLD.status IN ('booked', 'confirmed', 'in_progress');
  v_now_cancelled := NEW.status IN ('cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show');

  -- Cancellation: was active, now cancelled
  IF v_was_active AND v_now_cancelled THEN
    PERFORM public.dispatch_booking_notification('cancelled', NEW.id);
    RETURN NEW;
  END IF;

  -- Reschedule: starts_at changed, status still active
  IF NEW.status IN ('booked', 'confirmed')
     AND OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN
    PERFORM public.dispatch_booking_notification('rescheduled', NEW.id, OLD.starts_at);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger itself stays the same — only function body changed.
