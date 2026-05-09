-- P4.5: Multi-master booking support
-- group_booking_id links appointments created in the same multi-master session.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS group_booking_id uuid;

CREATE INDEX IF NOT EXISTS appointments_group_booking_idx ON appointments(group_booking_id)
  WHERE group_booking_id IS NOT NULL;
