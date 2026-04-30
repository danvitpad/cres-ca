-- Шаги 22 + 23 release-checklist:
-- 22) Правило отмены — мастер настраивает в Settings:
--      cancel_grace_hours: за сколько часов до записи отмена считается своевременной (24/12/6/1; default 24)
--      late_cancel_threshold: сколько поздних отмен подряд → метка в карточке (default 2)
--      no_show_threshold: сколько неявок → большая метка (default 1)
-- 23) Лист ожидания — клиент встаёт в очередь когда все слоты заняты;
--      на cancel записи матчинг даёт первому слот.

-- Шаг 22 ----------------------------------------------------------------------

ALTER TABLE masters
  ADD COLUMN IF NOT EXISTS cancel_grace_hours int NOT NULL DEFAULT 24
    CHECK (cancel_grace_hours IN (1, 6, 12, 24, 48));

ALTER TABLE masters
  ADD COLUMN IF NOT EXISTS late_cancel_threshold int NOT NULL DEFAULT 2
    CHECK (late_cancel_threshold BETWEEN 1 AND 5);

ALTER TABLE masters
  ADD COLUMN IF NOT EXISTS no_show_threshold int NOT NULL DEFAULT 1
    CHECK (no_show_threshold BETWEEN 1 AND 3);

-- Шаг 23 ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  preferred_days int[] DEFAULT '{1,2,3,4,5,6,0}'::int[], -- 0=Sun..6=Sat
  preferred_time_window text DEFAULT 'any' CHECK (preferred_time_window IN ('morning', 'afternoon', 'evening', 'any')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'expired', 'cancelled')),
  matched_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  notified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_master_status_idx ON waitlist(master_id, status, created_at);
CREATE INDEX IF NOT EXISTS waitlist_client_idx ON waitlist(client_profile_id, status);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Клиент может видеть/удалять свои записи в waitlist
CREATE POLICY waitlist_client_own ON waitlist
  FOR ALL TO authenticated
  USING (client_profile_id = auth.uid())
  WITH CHECK (client_profile_id = auth.uid());

-- Мастер может видеть свой waitlist (через masters.profile_id)
CREATE POLICY waitlist_master_own ON waitlist
  FOR SELECT TO authenticated
  USING (master_id IN (SELECT id FROM masters WHERE profile_id = auth.uid()));
