-- CF4: Add appointment_id to before_after_photos so a pair is tied to a specific visit.
-- Backfill: best-effort match by (master_id, service_id) to the earliest matching appointment per photo.

ALTER TABLE before_after_photos
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_before_after_appointment ON before_after_photos(appointment_id);

-- Backfill: for each photo, pick the earliest completed appointment with matching master+service
-- (best-effort — null remains if no match)
UPDATE before_after_photos bap
SET appointment_id = sub.apt_id
FROM (
  SELECT DISTINCT ON (bap2.id)
    bap2.id AS photo_id,
    a.id AS apt_id
  FROM before_after_photos bap2
  JOIN appointments a
    ON a.master_id = bap2.master_id
   AND a.service_id = bap2.service_id
  WHERE bap2.appointment_id IS NULL
  ORDER BY bap2.id, a.starts_at ASC
) sub
WHERE bap.id = sub.photo_id
  AND bap.appointment_id IS NULL;
