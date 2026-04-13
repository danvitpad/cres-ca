-- Phase 7b: distinguish client-initiated cancellations from master/no-show cancellations
-- Needed for trust analytics and cancellation policy enforcement.

ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_client';

-- Allow clients to cancel their OWN appointments (UPDATE policy).
-- Uses clients.profile_id ladder.

DROP POLICY IF EXISTS "Clients can cancel own appointments" ON appointments;
CREATE POLICY "Clients can cancel own appointments"
  ON appointments FOR UPDATE
  USING (
    client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
  );
