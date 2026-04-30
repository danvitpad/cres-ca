-- Таблица жалоб клиента на мастера или конкретную запись.
-- Шаг 18 release-checklist: «оценка ≠ жалоба». Если у клиента реальная проблема
-- (хамство, неявка, грязь, обман по цене) — отдельная кнопка «Пожаловаться» с
-- описанием попадает к superadmin для модерации.

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  reason_code text NOT NULL CHECK (reason_code IN ('no_show', 'rude', 'wrong_service', 'dirty', 'overpriced', 'other')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  resolution_note text,
  closed_at timestamptz,
  closed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS complaints_reporter_idx ON complaints(reporter_id);
CREATE INDEX IF NOT EXISTS complaints_master_idx ON complaints(master_id);
CREATE INDEX IF NOT EXISTS complaints_appointment_idx ON complaints(appointment_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status, created_at DESC);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_insert_own" ON complaints
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "complaints_select_own" ON complaints
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE OR REPLACE FUNCTION complaints_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER complaints_updated_at_trigger
BEFORE UPDATE ON complaints
FOR EACH ROW EXECUTE FUNCTION complaints_set_updated_at();
