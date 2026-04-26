-- 00106: партиальный uniq на (profile_id, master_id) для авто-CRM из follow-toggle.
-- Manual-clients (без auth-user) могут дублироваться по имени/телефону — это поведение оставляем.
-- Только для linked clients (когда профиль реально есть) гарантируем 1 строку per (client, master).
CREATE UNIQUE INDEX IF NOT EXISTS clients_profile_master_uq
  ON public.clients (profile_id, master_id)
  WHERE profile_id IS NOT NULL;

-- Backfill: для всех существующих client_master_links без соответствующего clients-row
-- создать недостающие, чтобы такие как Зоя сразу появились в /clients у мастера.
INSERT INTO clients (profile_id, master_id, full_name, phone, email, date_of_birth)
SELECT
  cml.profile_id,
  cml.master_id,
  COALESCE(p.full_name, 'Клиент'),
  p.phone,
  p.email,
  p.date_of_birth
FROM client_master_links cml
JOIN profiles p ON p.id = cml.profile_id
WHERE NOT EXISTS (
  SELECT 1 FROM clients c
  WHERE c.profile_id = cml.profile_id AND c.master_id = cml.master_id
);
