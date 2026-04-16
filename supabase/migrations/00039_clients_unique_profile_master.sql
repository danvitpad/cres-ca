-- Add unique constraint on clients(profile_id, master_id) so upsert works
-- when auto-creating client records from follows.
-- profile_id is nullable (manual clients without accounts), so this only constrains linked clients.

CREATE UNIQUE INDEX IF NOT EXISTS clients_profile_master_unique
  ON clients (profile_id, master_id)
  WHERE profile_id IS NOT NULL;

-- Backfill: create client records for existing followers who don't have one yet
INSERT INTO clients (profile_id, master_id, full_name, phone, email)
SELECT
  cml.profile_id,
  cml.master_id,
  COALESCE(p.full_name, 'Клиент'),
  p.phone,
  p.email
FROM client_master_links cml
JOIN profiles p ON p.id = cml.profile_id
LEFT JOIN clients c ON c.profile_id = cml.profile_id AND c.master_id = cml.master_id
WHERE c.id IS NULL;
