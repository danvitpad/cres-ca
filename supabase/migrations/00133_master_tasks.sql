-- 00133_master_tasks.sql
--
-- Master / Salon "My Tasks" (todo list with minute-precision reminders).
--
-- Use cases:
--   • Master: «через 30 минут позвонить Марии» (voice or manual)
--   • Master: «завтра в 10 утра заказать материалы»
--   • Salon admin: «напомнить Олегу проверить календарь завтра в 9»
--
-- Design:
--   • A task is owned by either a master (`master_id`) OR a salon (`salon_id`)
--     OR both (admin assigns task to a master inside the salon).
--   • `assigned_to` is the profile that should RECEIVE the reminder. For solo
--     master tasks this equals master.profile_id. For admin-created tasks it
--     can be the admin themselves OR a specific master in the team.
--   • Cron `/api/cron/master-tasks` runs every minute, finds rows where
--     `status='pending' AND remind_at <= now()`, enqueues a TG/email/inapp
--     notification to `assigned_to`, marks the task as `fired`.
--   • User can mark task `completed` from the UI; or it stays `fired` (so the
--     "history" tab shows fired+completed; pending tab shows pending only).

CREATE TABLE IF NOT EXISTS master_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid REFERENCES masters(id) ON DELETE CASCADE,
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  remind_at timestamptz NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['telegram']::text[],
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','fired','completed','cancelled')),
  fired_at timestamptz,
  completed_at timestamptz,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- one of master_id or salon_id must be set (or both)
  CONSTRAINT master_tasks_owner_present
    CHECK (master_id IS NOT NULL OR salon_id IS NOT NULL)
);

-- Cron picks up due tasks via this index — partial on pending only.
CREATE INDEX IF NOT EXISTS idx_master_tasks_due
  ON master_tasks(remind_at) WHERE status = 'pending';

-- Per-master list view
CREATE INDEX IF NOT EXISTS idx_master_tasks_master_status
  ON master_tasks(master_id, status, remind_at);

-- Per-recipient list view (solo + assigned)
CREATE INDEX IF NOT EXISTS idx_master_tasks_assigned
  ON master_tasks(assigned_to, status, remind_at);

-- Salon-scoped queries
CREATE INDEX IF NOT EXISTS idx_master_tasks_salon
  ON master_tasks(salon_id, status, remind_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_master_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS master_tasks_updated_at ON master_tasks;
CREATE TRIGGER master_tasks_updated_at
  BEFORE UPDATE ON master_tasks
  FOR EACH ROW EXECUTE FUNCTION trg_master_tasks_updated_at();

-- RLS
ALTER TABLE master_tasks ENABLE ROW LEVEL SECURITY;

-- Read: creator OR assigned_to OR (salon owner/admin if task is salon-scoped) OR (master owns the master_id row)
DROP POLICY IF EXISTS master_tasks_select ON master_tasks;
CREATE POLICY master_tasks_select ON master_tasks FOR SELECT
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM masters m
    WHERE m.id = master_tasks.master_id
      AND m.profile_id = auth.uid()
  )
  OR (
    salon_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM salon_members sm
      WHERE sm.salon_id = master_tasks.salon_id
        AND sm.profile_id = auth.uid()
        AND sm.status = 'active'
        AND sm.role IN ('owner','admin','receptionist')
    )
  )
);

-- Insert: must be the creator (auth.uid())
DROP POLICY IF EXISTS master_tasks_insert ON master_tasks;
CREATE POLICY master_tasks_insert ON master_tasks FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Update: creator OR assigned_to OR salon admin/owner
DROP POLICY IF EXISTS master_tasks_update ON master_tasks;
CREATE POLICY master_tasks_update ON master_tasks FOR UPDATE
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (
    salon_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM salon_members sm
      WHERE sm.salon_id = master_tasks.salon_id
        AND sm.profile_id = auth.uid()
        AND sm.status = 'active'
        AND sm.role IN ('owner','admin')
    )
  )
);

-- Delete: creator OR salon admin/owner
DROP POLICY IF EXISTS master_tasks_delete ON master_tasks;
CREATE POLICY master_tasks_delete ON master_tasks FOR DELETE
USING (
  created_by = auth.uid()
  OR (
    salon_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM salon_members sm
      WHERE sm.salon_id = master_tasks.salon_id
        AND sm.profile_id = auth.uid()
        AND sm.status = 'active'
        AND sm.role IN ('owner','admin')
    )
  )
);

COMMENT ON TABLE master_tasks IS
  'Personal/team todo list with minute-precision reminders. Cron /api/cron/master-tasks fires due reminders into the notifications queue.';
